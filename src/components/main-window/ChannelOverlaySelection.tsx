import { useEffect, useRef, useState } from "react"
import { MdEdit } from "react-icons/md"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Checkbox } from "@/components/ui/checkbox"

export default function ChannelOverlaySelection() {
    type OverlayItem = {
        _id: string
        name: string
    }

	const [overlays, setOverlays] = useState<OverlayItem[]>([])
	// Per-channel grouping flags: channels with checkbox ON form a group
	const [group, setGroup] = useState<Record<number, boolean>>({ 1: false, 2: false, 3: false, 4: false })
    const [ch1OverlayId, setCh1OverlayId] = useState<string | null>(null)
    const [ch2OverlayId, setCh2OverlayId] = useState<string | null>(null)
    const [ch3OverlayId, setCh3OverlayId] = useState<string | null>(null)
    const [ch4OverlayId, setCh4OverlayId] = useState<string | null>(null)
    const [projectId, setProjectId] = useState<string | null>(null)
    const ch1Ref = useRef<string | null>(null)
    const ch2Ref = useRef<string | null>(null)
    const ch3Ref = useRef<string | null>(null)
    const ch4Ref = useRef<string | null>(null)

    // WebSocket connections per channel (1-based index)
    const socketsRef = useRef<Record<number, WebSocket | null>>({})
    const WS_HOST = '127.0.0.1'
    const WS_PORT = 3620

    function getSocket(channelIndex: number): WebSocket {
        const existing = socketsRef.current[channelIndex]
        if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
            return existing
        }
        try {
            const ws = new WebSocket(`ws://${WS_HOST}:${WS_PORT}/overlay?ch=${channelIndex}`)
            ws.addEventListener('close', () => {
                try { if (socketsRef.current[channelIndex] === ws) socketsRef.current[channelIndex] = null } catch {}
            })
            ws.addEventListener('error', () => {
                try { /* swallow */ } catch {}
            })
            socketsRef.current[channelIndex] = ws
            return ws
        } catch {
            return existing ?? ({} as any)
        }
    }

    function sendOverlaySelection(channelIndex: number, overlayId: string | null) {
		try {
			const ws = getSocket(channelIndex)
			const payload = overlayId ? JSON.stringify({ overlayId }) : 'none'
			if (!ws || typeof (ws as any).send !== 'function') return
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(payload)
			} else if (ws.readyState === WebSocket.CONNECTING) {
				ws.addEventListener('open', () => {
					try { ws.send(payload) } catch {}
				}, { once: true })
			} else {
				try {
					const next = getSocket(channelIndex)
					next.addEventListener('open', () => {
						try { next.send(payload) } catch {}
					}, { once: true })
				} catch {}
			}
		} catch {}
	}

    async function setOverlayForChannel(channelIndex: number, overlayId: string | null) {
		switch (channelIndex) {
			case 1: setCh1OverlayId(overlayId); ch1Ref.current = overlayId; break
			case 2: setCh2OverlayId(overlayId); ch2Ref.current = overlayId; break
			case 3: setCh3OverlayId(overlayId); ch3Ref.current = overlayId; break
			case 4: setCh4OverlayId(overlayId); ch4Ref.current = overlayId; break
		}
		sendOverlaySelection(channelIndex, overlayId)
        // persist per-channel overlay selection on the project
        try {
            const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
            const pid: string | null = res?.ok ? (res.data ?? null) : null
            if (pid) {
                const key = (
                    channelIndex === 1 ? 'lastSelectedOverlayCh1Id' :
                    channelIndex === 2 ? 'lastSelectedOverlayCh2Id' :
                    channelIndex === 3 ? 'lastSelectedOverlayCh3Id' :
                    'lastSelectedOverlayCh4Id'
                ) as 'lastSelectedOverlayCh1Id'
                await window.ipcRenderer.invoke('db:editProject', pid, { [key]: overlayId })
            }
        } catch {}
	}

	function getGroupedTargets(origin: number): number[] {
		const selected: number[] = []
		for (const idx of [1, 2, 3, 4]) {
			if (group[idx]) selected.push(idx)
		}
		if (selected.includes(origin) && selected.length >= 2) return selected
		return [origin]
	}

    // Load and apply last selected overlays when project changes or on mount
    useEffect(() => {
        let cancelled = false
        async function applyFromProject(projectId: string | null) {
            if (cancelled) return
            if (!projectId) {
                setCh1OverlayId(null); ch1Ref.current = null
                setCh2OverlayId(null); ch2Ref.current = null
                setCh3OverlayId(null); ch3Ref.current = null
                setCh4OverlayId(null); ch4Ref.current = null
                try {
                    sendOverlaySelection(1, null)
                    sendOverlaySelection(2, null)
                    sendOverlaySelection(3, null)
                    sendOverlaySelection(4, null)
                } catch {}
                return
            }
            try {
                const det = await window.ipcRenderer.invoke('db:getSelectedProjectDetails', projectId)
                if (!det?.ok || cancelled) return
                const ch1 = det.data?.lastSelectedOverlayCh1Id ?? null
                const ch2 = det.data?.lastSelectedOverlayCh2Id ?? null
                const ch3 = det.data?.lastSelectedOverlayCh3Id ?? null
                const ch4 = det.data?.lastSelectedOverlayCh4Id ?? null
                setCh1OverlayId(ch1); ch1Ref.current = ch1
                setCh2OverlayId(ch2); ch2Ref.current = ch2
                setCh3OverlayId(ch3); ch3Ref.current = ch3
                setCh4OverlayId(ch4); ch4Ref.current = ch4
                try {
                    sendOverlaySelection(1, ch1)
                    sendOverlaySelection(2, ch2)
                    sendOverlaySelection(3, ch3)
                    sendOverlaySelection(4, ch4)
                } catch {}
            } catch {}
        }
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                if (!cancelled && res?.ok) {
                    const pid: string | null = res.data ?? null
                    setProjectId(pid)
                    await applyFromProject(pid)
                }
            } catch {}
        })()
        const onProjectChanged = (e: any) => {
            try {
                const pid = e?.detail ?? null
                setProjectId(pid)
                applyFromProject(pid)
            } catch {}
        }
        window.addEventListener('selectedProjectChanged', onProjectChanged as any)
        return () => {
            cancelled = true
            window.removeEventListener('selectedProjectChanged', onProjectChanged as any)
        }
    }, [])

    async function loadOverlays() {
        try {
            const res = await window.ipcRenderer.invoke('db:getAllOverlay')
            if (res?.ok && Array.isArray(res.data)) {
                setOverlays(res.data)
                // Clear selection if it no longer exists
                const ids = new Set((res.data as OverlayItem[]).map(o => o._id))
                if (ch1OverlayId && !ids.has(ch1OverlayId)) setCh1OverlayId(null)
                if (ch2OverlayId && !ids.has(ch2OverlayId)) setCh2OverlayId(null)
                if (ch3OverlayId && !ids.has(ch3OverlayId)) setCh3OverlayId(null)
                if (ch4OverlayId && !ids.has(ch4OverlayId)) setCh4OverlayId(null)
            } else {
                setOverlays([])
            }
        } catch {
            setOverlays([])
        }
    }

    useEffect(() => {
        loadOverlays()
        const onChanged = (e?: any) => {
            try {
                const detail = e?.detail
                if (detail && detail.action === 'deleted' && detail.id) {
                    const deletedId = String(detail.id)
                    // Clear per-channel selections that reference the deleted overlay and notify overlay.html
                    if (ch1Ref.current === deletedId) { setOverlayForChannel(1, null) }
                    if (ch2Ref.current === deletedId) { setOverlayForChannel(2, null) }
                    if (ch3Ref.current === deletedId) { setOverlayForChannel(3, null) }
                    if (ch4Ref.current === deletedId) { setOverlayForChannel(4, null) }
                }
            } catch {}
            loadOverlays()
        }
        window.addEventListener('overlaysChanged', onChanged as any)
        // Listen for Electron-level overlay rename events
        try {
            (window as any).ipcRenderer?.on('overlays:changed', (_e: any, payload: any) => {
                try {
                    if (payload && payload.action === 'deleted' && payload.id) {
                        const deletedId = String(payload.id)
                        if (ch1Ref.current === deletedId) { setOverlayForChannel(1, null) }
                        if (ch2Ref.current === deletedId) { setOverlayForChannel(2, null) }
                        if (ch3Ref.current === deletedId) { setOverlayForChannel(3, null) }
                        if (ch4Ref.current === deletedId) { setOverlayForChannel(4, null) }
                    }
                } catch {}
                try { loadOverlays() } catch {}
            })
        } catch {}
        return () => {
            window.removeEventListener('overlaysChanged', onChanged as any)
            try { (window as any).ipcRenderer?.off('overlays:changed') } catch {}
        }
    }, [])

    useEffect(() => {
        // Cleanup sockets on unmount
        return () => {
            try {
                Object.values(socketsRef.current).forEach(ws => {
                    try { ws?.close() } catch {}
                })
            } catch {}
            socketsRef.current = {}
        }
    }, [])

    return (
        <div className="flex flex-col gap-2">
            <button
                title="Overlay Editor"
                className="flex items-center justify-center gap-2 border border-white/10 h-[40px] bg-black/50 hover:bg-black/40 active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none"
                onClick={() => window.ipcRenderer.invoke('window:open-overlay-editor')}
            >
                <MdEdit className="h-4.5 w-4.5" />
                <span className="font-semibold text-[14px]">Open Overlay Editor</span>
            </button>
            <div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<span className="text-white font-semibold">Channel 1</span>
					<div className="flex items-center justify-center gap-1.5">
						<Checkbox disabled={!projectId} checked={!!group[1]} onCheckedChange={(v) => setGroup((g) => ({ ...g, 1: !!v }))} />
						<span className="text-[14px] font-medium">Group</span>
					</div>
				</div>
                <Select disabled={!projectId} value={ch1OverlayId ?? 'none'} onValueChange={(val) => {
                    const next = (val === 'none') ? null : val
					const targets = getGroupedTargets(1)
					for (const idx of targets) setOverlayForChannel(idx, next)
                }}>
                    <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder="Select overlay…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {overlays.map(o => (
                            <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<span className="text-white font-semibold">Channel 2</span>
					<div className="flex items-center justify-center gap-1.5">
						<Checkbox disabled={!projectId} checked={!!group[2]} onCheckedChange={(v) => setGroup((g) => ({ ...g, 2: !!v }))} />
						<span className="text-[14px] font-medium">Group</span>
					</div>
				</div>
				<Select disabled={!projectId} value={ch2OverlayId ?? 'none'} onValueChange={(val) => {
					const next = (val === 'none') ? null : val
					const targets = getGroupedTargets(2)
					for (const idx of targets) setOverlayForChannel(idx, next)
				}}>
                    <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder="Select overlay…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {overlays.map(o => (
                            <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<span className="text-white font-semibold">Channel 3</span>
					<div className="flex items-center justify-center gap-1.5">
						<Checkbox disabled={!projectId} checked={!!group[3]} onCheckedChange={(v) => setGroup((g) => ({ ...g, 3: !!v }))} />
						<span className="text-[14px] font-medium">Group</span>
					</div>
				</div>
				<Select disabled={!projectId} value={ch3OverlayId ?? 'none'} onValueChange={(val) => {
					const next = (val === 'none') ? null : val
					const targets = getGroupedTargets(3)
					for (const idx of targets) setOverlayForChannel(idx, next)
				}}>
                    <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder="Select overlay…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {overlays.map(o => (
                            <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<span className="text-white font-semibold">Channel 4</span>
					<div className="flex items-center justify-center gap-1.5">
						<Checkbox disabled={!projectId} checked={!!group[4]} onCheckedChange={(v) => setGroup((g) => ({ ...g, 4: !!v }))} />
						<span className="text-[14px] font-medium">Group</span>
					</div>
				</div>
				<Select disabled={!projectId} value={ch4OverlayId ?? 'none'} onValueChange={(val) => {
					const next = (val === 'none') ? null : val
					const targets = getGroupedTargets(4)
					for (const idx of targets) setOverlayForChannel(idx, next)
				}}>
                    <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder="Select overlay…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {overlays.map(o => (
                            <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

    )
}