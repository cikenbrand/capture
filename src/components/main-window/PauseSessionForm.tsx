import { memo } from "react"
import { Button } from "../ui/button"

type Props = { onClose?: () => void }

export default memo(function PauseSessionForm({ onClose }: Props) {
    async function handlePause() {
        try {
            await window.ipcRenderer.invoke('obs:pause-recording')
        } catch { }
        try { await window.ipcRenderer.invoke('recording:updateState', { isRecordingPaused: true }) } catch {}
        try { window.dispatchEvent(new Event('recordingStateChanged')) } catch {}
        // Add project log for pause
        try {
            const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
            const projectId = proj?.ok ? (proj.data ?? null) : null
            if (projectId) {
                const [diveRes, taskRes, nodeRes, fmt] = await Promise.all([
                    window.ipcRenderer.invoke('app:getSelectedDiveId'),
                    window.ipcRenderer.invoke('app:getSelectedTaskId'),
                    window.ipcRenderer.invoke('app:getSelectedNodeId'),
                    window.ipcRenderer.invoke('obs:get-file-name-formatting').catch(() => null),
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
                const fileNames: string[] = []
                try {
                    const previewFmt = fmt && typeof fmt.preview === 'string' ? fmt.preview : ''
                    const ch1Fmt = fmt && typeof fmt.ch1 === 'string' ? fmt.ch1 : ''
                    const ch2Fmt = fmt && typeof fmt.ch2 === 'string' ? fmt.ch2 : ''
                    const ch3Fmt = fmt && typeof fmt.ch3 === 'string' ? fmt.ch3 : ''
                    const ch4Fmt = fmt && typeof fmt.ch4 === 'string' ? fmt.ch4 : ''
                    if (previewFmt) fileNames.push(previewFmt)
                    if (ch1Fmt) fileNames.push(ch1Fmt)
                    if (ch2Fmt) fileNames.push(ch2Fmt)
                    if (ch3Fmt) fileNames.push(ch3Fmt)
                    if (ch4Fmt) fileNames.push(ch4Fmt)
                } catch {}
                await window.ipcRenderer.invoke('db:addProjectLog', {
                    projectId,
                    event: 'Recording Paused',
                    dive: diveName || null,
                    task: taskName || null,
                    components: nodeName ? `(${nodeName})` : null,
                    fileName: fileNames.length ? fileNames.join(', ') : null,
                })
                try { window.dispatchEvent(new Event('projectLogsChanged')) } catch {}
            }
        } catch {}
        onClose?.()
    }
    return (
        <div className="flex flex-col gap-4">
            <div className="text-white/80">Pause or resume the current recording?</div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>Close</Button>
                <Button onClick={handlePause}>Toggle Pause</Button>
            </div>
        </div>
    )
})