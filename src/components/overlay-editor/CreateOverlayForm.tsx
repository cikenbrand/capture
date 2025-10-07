import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    onClose: () => void
}

export default function CreateOverlayForm({ onClose }: Props) {
    const [name, setName] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [presets, setPresets] = useState<Array<{ _id: string; name: string }>>([])
    const [presetId, setPresetId] = useState<string>("none")

    async function onCreate() {
        setError(null)
        if (!name.trim()) {
            setError("Overlay name is required")
            return
        }
        try {
            setSubmitting(true)
            const result = await window.ipcRenderer.invoke('db:createOverlay', {
                name,
            })
            if (result?.ok) {
                try {
                    const newId: string | undefined = result.data
                    // If a preset is selected, copy its components into the new overlay
                    if (newId && presetId && presetId !== 'none') {
                        try {
                            const compRes = await window.ipcRenderer.invoke('db:getOverlayComponentsForRender', { overlayId: presetId })
                            const list = compRes?.ok && Array.isArray(compRes.data) ? compRes.data : []
                            if (list.length) {
                                const perTypeCounts = new Map<string, number>()
                                const makeName = (type: string) => {
                                    const current = perTypeCounts.get(type) || 0
                                    const next = current + 1
                                    perTypeCounts.set(type, next)
                                    return `${type}-${next}`
                                }
                                // Create sequentially to avoid any external race conditions
                                for (const c of list as any[]) {
                                    const type = String(c.type || 'component')
                                    const nameForNew = makeName(type)
                                    await window.ipcRenderer.invoke('db:createOverlayComponent', {
                                        overlayId: newId,
                                        name: nameForNew,
                                        type: c.type,
                                        x: c.x,
                                        y: c.y,
                                        width: c.width,
                                        height: c.height,
                                        backgroundColor: c.backgroundColor,
                                        borderColor: c.borderColor,
                                        radius: c.radius,
                                        textStyle: c.textStyle,
                                        customText: c.customText,
                                        dateFormat: c.dateFormat,
                                        twentyFourHour: c.twentyFourHour,
                                        useUTC: c.useUTC,
                                        dataType: c.dataType,
                                        nodeLevel: c.nodeLevel,
                                        imagePath: c.imagePath,
                                        opacity: c.opacity,
                                        projectDetail: c.projectDetail,
                                    })
                                }
                            }
                        } catch (err) {
                            // surface copy error but still allow overlay creation
                            const message = err instanceof Error ? err.message : 'Failed to copy preset components'
                            setError(message)
                        }
                    }
                    const ev = new CustomEvent('overlaysChanged', { detail: { id: newId, action: 'created' } })
                    window.dispatchEvent(ev)
                } catch {}
                // Notify channel overlay selection to refresh (Electron event also emitted)
                try { (window as any).ipcRenderer?.send?.('noop') } catch {}
                onClose()
            } else {
                setError(result?.error || 'Failed to create overlay')
            }
        } finally {
            setSubmitting(false)
        }
    }

    // Load overlays for preset selection
    // Note: exclude none; we'll include an explicit 'None' option in the Select
    ;(async () => {
        try {
            const res = await window.ipcRenderer.invoke('db:getAllOverlay')
            const items = res?.ok && Array.isArray(res.data) ? res.data : []
            setPresets(items.map((o: any) => ({ _id: String(o._id), name: String(o.name || '') })))
        } catch {}
    })()

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span>Overlay Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span>Preset Reference</span>
                <Select
                    value={presetId}
                    onValueChange={(v) => setPresetId(v)}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select preset (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {presets.map((p) => (
                            <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button onClick={onCreate} disabled={submitting || !name.trim()}>
                    Create
                </Button>
            </div>
        </div>
    )
}