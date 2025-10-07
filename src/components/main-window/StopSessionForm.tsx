import { memo, useState } from "react"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { toast } from "sonner"

type Props = {
  onClose: () => void
}

export default memo(function StopSessionForm({ onClose }: Props) {
  const [markCompleted, setMarkCompleted] = useState(false)
  async function handleStop() {
    try {
      await window.ipcRenderer.invoke('obs:stop-recording')
    } catch {}
    try {
      await window.ipcRenderer.invoke('recording:updateState', {
        isRecordingStarted: false,
        isRecordingPaused: false,
        isRecordingStopped: true,
      })
    } catch {}
    try { window.dispatchEvent(new Event('recordingStateChanged')) } catch {}
    // Add project log and refresh logs table
    try {
      const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
      const projectId = proj?.ok ? (proj.data ?? null) : null
      if (projectId) {
        // Gather current selections
        const [diveRes, taskRes, nodeRes] = await Promise.all([
          window.ipcRenderer.invoke('app:getSelectedDiveId'),
          window.ipcRenderer.invoke('app:getSelectedTaskId'),
          window.ipcRenderer.invoke('app:getSelectedNodeId'),
        ])
        const diveId = diveRes?.ok ? (diveRes.data ?? null) : null
        const taskId = taskRes?.ok ? (taskRes.data ?? null) : null
        const nodeId = nodeRes?.ok ? (nodeRes.data ?? null) : null

        // Resolve names
        let diveName = ''
        let taskName = ''
        let nodeName = ''
        try { if (diveId) { const d = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', diveId); diveName = d?.ok ? (d.data?.name ?? '') : '' } } catch {}
        try { if (taskId) { const t = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', taskId); taskName = t?.ok ? (t.data?.name ?? '') : '' } } catch {}
        try { if (nodeId) { const n = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId); nodeName = n?.ok ? (n.data?.name ?? '') : '' } } catch {}

        // Get current OBS file name formatting to include filenames
        const fmt = await window.ipcRenderer.invoke('obs:get-file-name-formatting').catch(() => null)
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
          event: 'Recording Stopped',
          dive: diveName || null,
          task: taskName || null,
          components: nodeName ? `(${nodeName})` : null,
          fileName: fileNames.length ? fileNames.join(', ') : null,
        })
        try { window.dispatchEvent(new Event('projectLogsChanged')) } catch {}

        // Optionally mark current node as completed
        try {
          if (markCompleted && nodeId) {
            await window.ipcRenderer.invoke('db:editNode', nodeId, { status: 'completed' })
            try {
              const ev = new CustomEvent('nodesChanged', { detail: { id: nodeId, action: 'edited' } })
              window.dispatchEvent(ev)
            } catch {}
          }
        } catch {}
      }
    } catch {}
    try { toast.success('Recording stopped') } catch {}
    onClose()
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="text-white/80">
        Are you sure you want to stop the session?
      </div>
      <label className="flex items-center gap-2 text-white/80">
        <Checkbox checked={markCompleted} onCheckedChange={(v) => setMarkCompleted(v === true)} />
        <span>Mark current component as Completed</span>
      </label>
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleStop}>Stop Session</Button>
      </div>
    </div>
  )
})

