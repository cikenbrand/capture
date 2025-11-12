import { memo, useEffect, useState } from "react"
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
  const [disabledChannels, setDisabledChannels] = useState<Record<number, boolean>>({ 1: false, 2: false, 3: false, 4: false })

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

  // Listen for input-type changes from VideoDeviceConfigurations and disable when type === 'none'
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const detail = e?.detail || {}
        const ch = Number(detail.channel)
        const type = String(detail.inputType || '')
        if (Number.isFinite(ch) && ch >= 1 && ch <= 4) {
          setDisabledChannels(prev => ({ ...prev, [ch]: type === 'none' }))
        }
      } catch {}
    }
    window.addEventListener('video:input-type-changed', handler as any)
    return () => { try { window.removeEventListener('video:input-type-changed', handler as any) } catch {} }
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

      // Mark the selected node as Ongoing at session start
      try {
        await window.ipcRenderer.invoke('db:editNode', nodeId, { status: 'ongoing' })
        try {
          const ev = new CustomEvent('nodesChanged', { detail: { id: nodeId, action: 'edited' } })
          window.dispatchEvent(ev)
        } catch {}
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
        <div className="flex flex-col gap-6">
            <div className="text-center text-slate-400">Select channel to record</div>
            <div className="flex items-center justify-center gap-4">
                <Button
                    className={`h-[30px] px-4 min-w-[140px] text-white/40 hover:bg-black/20 ${previewEnabled ? 'bg-black/40 text-blue-200 hover:bg-black/40 font-semibold' : ''}`}
                    onClick={() => setPreviewEnabled(v => !v)}
                >
                    Preview
                </Button>
                <Button
                    className={`h-[30px] px-4 min-w-[140px] text-white/40 hover:bg-black/20 ${channel1Enabled ? 'bg-black/40 text-blue-200 hover:bg-black/40 font-semibold' : ''}`}
                    onClick={() => setChannel1Enabled(v => !v)}
                    disabled={disabledChannels[1]}
                >
                    Channel 1
                </Button>
                <Button
                    className={`h-[30px] px-4 min-w-[140px] text-white/40 hover:bg-black/20 ${channel2Enabled ? 'bg-black/40 text-blue-200 hover:bg-black/40 font-semibold' : ''}`}
                    onClick={() => setChannel2Enabled(v => !v)}
                    disabled={disabledChannels[2]}
                >
                    Channel 2
                </Button>
            </div>
            <div className="flex items-center justify-center gap-4">
                <Button
                    className={`h-[30px] px-4 min-w-[140px] text-white/40 hover:bg-black/20 ${channel3Enabled ? 'bg-black/40 text-blue-200 hover:bg-black/40 font-semibold' : ''}`}
                    onClick={() => setChannel3Enabled(v => !v)}
                    disabled={disabledChannels[3]}
                >
                    Channel 3
                </Button>
                <Button
                    className={`h-[30px] px-4 min-w-[140px] text-white/40 hover:bg-black/20 ${channel4Enabled ? 'bg-black/40 text-blue-200 hover:bg-black/40 font-semibold' : ''}`}
                    onClick={() => setChannel4Enabled(v => !v)}
                    disabled={disabledChannels[4]}
                >
                    Channel 4
                </Button>
            </div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleStart} disabled={!(previewEnabled || channel1Enabled || channel2Enabled || channel3Enabled || channel4Enabled)}>Start Session</Button>
            </div>
        </div>
    )
})

