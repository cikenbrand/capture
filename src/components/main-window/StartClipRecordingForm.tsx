import { memo, useEffect } from "react"
import { Button } from "../ui/button"

type Props = { onClose?: () => void }

export default memo(function StartClipRecordingForm({ onClose }: Props) {
    async function handleStartClip() {
        try {
            await window.ipcRenderer.invoke('obs:start-clip-recording')
        } catch {}
        try { await window.ipcRenderer.invoke('recording:updateState', { isClipRecordingStarted: true }) } catch {}
        try { window.dispatchEvent(new Event('recordingStateChanged')) } catch {}
        // Add project log: Clip Started
        try {
            const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
            const projectId = proj?.ok ? (proj.data ?? null) : null
            if (projectId) {
                const [diveRes, taskRes, nodeRes] = await Promise.all([
                    window.ipcRenderer.invoke('app:getSelectedDiveId'),
                    window.ipcRenderer.invoke('app:getSelectedTaskId'),
                    window.ipcRenderer.invoke('app:getSelectedNodeId'),
                ])
                const diveId = diveRes?.ok ? (diveRes.data ?? null) : null
                const taskId = taskRes?.ok ? (taskRes.data ?? null) : null
                const nodeId = nodeRes?.ok ? (nodeRes.data ?? null) : null
                let diveName = ''
                let taskName = ''
                let nodeName = ''
                try { if (diveId) { const d = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', diveId); diveName = d?.ok ? (d.data?.name ?? '') : '' } } catch {}
                try { if (taskId) { const t = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', taskId); taskName = t?.ok ? (t.data?.name ?? '') : '' } } catch {}
                try { if (nodeId) { const n = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId); nodeName = n?.ok ? (n.data?.name ?? '') : '' } } catch {}
                // Get clip filename formatting
                let clipFileName = ''
                try {
                    const fmt = await window.ipcRenderer.invoke('obs:get-clip-file-name-formatting')
                    clipFileName = typeof fmt === 'string' ? fmt : ''
                } catch {}
                await window.ipcRenderer.invoke('db:addProjectLog', {
                    projectId,
                    event: 'Clip Started',
                    dive: diveName || null,
                    task: taskName || null,
                    components: nodeName ? `(${nodeName})` : null,
                    fileName: clipFileName || null,
                })
                try { window.dispatchEvent(new Event('projectLogsChanged')) } catch {}
            }
        } catch {}
        onClose?.()
    }
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const now = new Date()
                const yy = String(now.getFullYear()).slice(-2)
                const mm = String(now.getMonth() + 1).padStart(2, '0')
                const dd = String(now.getDate()).padStart(2, '0')
                const hh = String(now.getHours()).padStart(2, '0')
                const mi = String(now.getMinutes()).padStart(2, '0')
                const ss = String(now.getSeconds()).padStart(2, '0')
                const yymmddhhmmss = `${yy}${mm}${dd}${hh}${mi}${ss}`

                if (!cancelled) {
                    try { await window.ipcRenderer.invoke('obs:set-clip-file-name-formatting', yymmddhhmmss) } catch {}
                }
            } catch {}
        })()
        return () => { cancelled = true }
    }, [])

    return (
        <div className="flex flex-col gap-4">
            <div className="text-white/80">Clip filename will be set to clip-yymmddhhmmss.</div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>Close</Button>
                <Button onClick={handleStartClip}>Start Clip</Button>
            </div>
        </div>
    )
})