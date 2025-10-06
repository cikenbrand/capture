import { memo, useEffect, useState } from "react"
import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { Button } from "../ui/button"

type Props = {
    onClose: () => void
}

export default memo(function StartSessionForm({ onClose }: Props) {
    const [previewPath, setPreviewPath] = useState("")
    const [channel1Path, setChannel1Path] = useState("")
    const [channel2Path, setChannel2Path] = useState("")
    const [channel3Path, setChannel3Path] = useState("")
    const [channel4Path, setChannel4Path] = useState("")
    const [previewFileName, setPreviewFileName] = useState("")
    const [channel1FileName, setChannel1FileName] = useState("")
    const [channel2FileName, setChannel2FileName] = useState("")
    const [channel3FileName, setChannel3FileName] = useState("")
    const [channel4FileName, setChannel4FileName] = useState("")
  const [previewEnabled, setPreviewEnabled] = useState(true)
  const [channel1Enabled, setChannel1Enabled] = useState(false)
  const [channel2Enabled, setChannel2Enabled] = useState(false)
  const [channel3Enabled, setChannel3Enabled] = useState(false)
  const [channel4Enabled, setChannel4Enabled] = useState(false)

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const now = new Date()
                    const dd = String(now.getDate()).padStart(2, '0')
                    const mm = String(now.getMonth() + 1).padStart(2, '0')
                    const yy = String(now.getFullYear()).slice(-2)
                    const hh = String(now.getHours()).padStart(2, '0')
                    const mi = String(now.getMinutes()).padStart(2, '0')
                    const ss = String(now.getSeconds()).padStart(2, '0')
                    const ddmmyyhhmmss = `${dd}${mm}${yy}${hh}${mi}${ss}`

                    try { await window.ipcRenderer.invoke('obs:set-file-name-formatting', ddmmyyhhmmss) } catch { }

                const dir = await window.ipcRenderer.invoke('obs:get-recording-directory') as unknown
                    const safe = typeof dir === 'string' ? dir : ""
                const currentFmt = await window.ipcRenderer.invoke('obs:get-file-name-formatting') as any
                const previewFmt = currentFmt && typeof currentFmt.preview === 'string' ? currentFmt.preview : ""
                const ch1Fmt = currentFmt && typeof currentFmt.ch1 === 'string' ? currentFmt.ch1 : ""
                const ch2Fmt = currentFmt && typeof currentFmt.ch2 === 'string' ? currentFmt.ch2 : ""
                const ch3Fmt = currentFmt && typeof currentFmt.ch3 === 'string' ? currentFmt.ch3 : ""
                const ch4Fmt = currentFmt && typeof currentFmt.ch4 === 'string' ? currentFmt.ch4 : ""
                    if (cancelled) return
                    setPreviewPath(safe)
                    setChannel1Path(safe)
                    setChannel2Path(safe)
                    setChannel3Path(safe)
                    setChannel4Path(safe)
                setPreviewFileName(previewFmt)
                setChannel1FileName(ch1Fmt)
                setChannel2FileName(ch2Fmt)
                setChannel3FileName(ch3Fmt)
                setChannel4FileName(ch4Fmt)
                } catch {
                    // ignore
                }
            })()
        return () => { cancelled = true }
    }, [])

    async function handleStart() {
        try {
      // Gather current selection ids
      const [projectRes, diveRes, taskRes, nodeRes] = await Promise.all([
        window.ipcRenderer.invoke('app:getSelectedProjectId'),
        window.ipcRenderer.invoke('app:getSelectedDiveId'),
        window.ipcRenderer.invoke('app:getSelectedTaskId'),
        window.ipcRenderer.invoke('app:getSelectedNodeId'),
      ])
      const projectId = projectRes?.ok ? (projectRes.data ?? null) : null
      const diveId = diveRes?.ok ? (diveRes.data ?? null) : null
      const taskId = taskRes?.ok ? (taskRes.data ?? null) : null
      const nodeId = nodeRes?.ok ? (nodeRes.data ?? null) : null

      if (!projectId || !diveId || !taskId || !nodeId) {
        throw new Error('Missing selection to create session')
      }

      // Create session record first
      const created = await window.ipcRenderer.invoke('db:createSession', {
        projectId,
        diveId,
        taskId,
        nodeId,
        ...(previewEnabled ? { preview: `${previewPath}\\${previewFileName}` } : {}),
        ...(channel1Enabled ? { ch1: `${channel1Path}\\${channel1FileName}` } : {}),
        ...(channel2Enabled ? { ch2: `${channel2Path}\\${channel2FileName}` } : {}),
        ...(channel3Enabled ? { ch3: `${channel3Path}\\${channel3FileName}` } : {}),
        ...(channel4Enabled ? { ch4: `${channel4Path}\\${channel4FileName}` } : {}),
      })
      try {
        const id = created?.ok ? (created.data ?? null) : null
        if (id) await window.ipcRenderer.invoke('app:setActiveSessionId', id)
      } catch {}

      // Add project log: Recording started
      try {
        const detDive = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', diveId)
        const diveName = detDive?.ok ? (detDive.data?.name ?? '') : ''
        const detTask = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', taskId)
        const taskName = detTask?.ok ? (detTask.data?.name ?? '') : ''

        // Build node hierarchy names "Structure A, Component A"
        let nodePath = ''
        try {
          const detNode = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId)
          const nodeName = detNode?.ok ? (detNode.data?.name ?? '') : ''
          // Reconstruct path from NodesTree would need parent traversal; fallback to current node name
          nodePath = nodeName
        } catch {}

        const fileNames: string[] = []
        if (previewEnabled && previewFileName) fileNames.push(previewFileName)
        if (channel1Enabled && channel1FileName) fileNames.push(channel1FileName)
        if (channel2Enabled && channel2FileName) fileNames.push(channel2FileName)
        if (channel3Enabled && channel3FileName) fileNames.push(channel3FileName)
        if (channel4Enabled && channel4FileName) fileNames.push(channel4FileName)

        await window.ipcRenderer.invoke('db:addProjectLog', {
          projectId,
          event: 'Recording Started',
          dive: diveName || null,
          task: taskName || null,
          components: nodePath ? `(${nodePath})` : null,
          fileName: fileNames.length ? fileNames.join(', ') : null,
        })
        try { window.dispatchEvent(new Event('projectLogsChanged')) } catch {}
      } catch {}

            await window.ipcRenderer.invoke('obs:start-recording', {
                preview: previewEnabled,
                ch1: channel1Enabled,
                ch2: channel2Enabled,
                ch3: channel3Enabled,
                ch4: channel4Enabled,
            })
            try { await window.ipcRenderer.invoke('recording:updateState', { isRecordingStarted: true, isRecordingStopped: false, isRecordingPaused: false }) } catch {}
            try { window.dispatchEvent(new Event('recordingStateChanged')) } catch {}
        } catch { }
        onClose()
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox checked={previewEnabled} onCheckedChange={(v) => setPreviewEnabled(v === true)} />
                    <span className="font-bold">Preview</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={previewPath} onChange={(e) => setPreviewPath(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={previewFileName} onChange={(e) => setPreviewFileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox checked={channel1Enabled} onCheckedChange={(v) => setChannel1Enabled(v === true)} />
                    <span className="font-bold">Channel 1</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={channel1Path} onChange={(e) => setChannel1Path(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={channel1FileName} onChange={(e) => setChannel1FileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox checked={channel2Enabled} onCheckedChange={(v) => setChannel2Enabled(v === true)} />
                    <span className="font-bold">Channel 2</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={channel2Path} onChange={(e) => setChannel2Path(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={channel2FileName} onChange={(e) => setChannel2FileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox checked={channel3Enabled} onCheckedChange={(v) => setChannel3Enabled(v === true)} />
                    <span className="font-bold">Channel 3</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={channel3Path} onChange={(e) => setChannel3Path(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={channel3FileName} onChange={(e) => setChannel3FileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <Checkbox checked={channel4Enabled} onCheckedChange={(v) => setChannel4Enabled(v === true)} />
                    <span className="font-bold">Channel 4</span>
                </div>
                <div className="flex gap-2 items-center text-nowrap">
                    <div className="flex gap-1 items-center">
                        <span>Path</span>
                        <Input className="h-7" value={channel4Path} onChange={(e) => setChannel4Path(e.target.value)} />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span>File Name</span>
                        <Input className="h-7" value={channel4FileName} onChange={(e) => setChannel4FileName(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleStart}>Start Session</Button>
            </div>
        </div>
    )
})

