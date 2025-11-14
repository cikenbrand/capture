import AppWindowBar from "./components/main-window/AppWindowBar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DraggableDialog } from "@/components/ui/draggable-dialog"
import AddNewDive from "./components/main-window/AddNewDiveForm"
import { useEffect, useRef, useState } from "react"
import { BiPlus } from "react-icons/bi";
import { MdAdd, MdCameraRoll, MdDelete, MdEdit } from "react-icons/md";
import DiveSelection from "./components/main-window/DiveSelection"
import EditDiveForm from "./components/main-window/EditDiveForm"
import ShowDiveRemarks from "./components/main-window/ShowDiveRemarks"
import StartDiveButton from "./components/main-window/StartDiveButton"
import CreateTaskForm from "./components/main-window/CreateTaskForm"
import TaskSelection from "./components/main-window/TaskSelection"
import EditTaskForm from "./components/main-window/EditTaskForm"
import ShowTaskRemarks from "./components/main-window/ShowTaskRemarks"
import NodesTree from "./components/main-window/NodesTree"
import AddNewNodeForm from "./components/main-window/AddNewNodeForm"
import EditNodeDetailsForm from "./components/main-window/EditNodeDetailsForm"
// Delete node dialog removed
import PreviewVirtualCam from "./components/main-window/PreviewVirtualCam"
import { FaCircle, FaMicrophone, FaMicrophoneSlash, FaPause, FaPlay, FaStop } from "react-icons/fa"
import { BsCameraFill } from "react-icons/bs";
import AudioMeter, { AudioMeterLive } from "./components/main-window/AudioMeter"
import CursorToolButton from "./components/main-window/CursorToolButton"
import FreeDrawToolButton from "./components/main-window/FreeDrawToolButton"
import ArrowDrawingTool from "./components/main-window/ArrowDrawingTool"
import CircleDrawingTool from "./components/main-window/CircleDrawingTool"
import AllLogsTable from "./components/main-window/AllLogsTable"
import ChannelViewList from "./components/main-window/ChannelViewList"
import ChannelOverlaySelection from "./components/main-window/ChannelOverlaySelection"
import ShowNodesRemarks from "./components/main-window/ShowNodesRemarks"
import StartSessionForm from "./components/main-window/StartSessionForm"
import StopSessionForm from "./components/main-window/StopSessionForm"
import PauseSessionForm from "./components/main-window/PauseSessionForm"
import StartClipRecordingForm from "./components/main-window/StartClipRecordingForm"
import StopClipRecordingForm from "./components/main-window/StopClipRecordingForm"
import SessionTimer from "./components/main-window/SessionTimer"
import ClipTimer from "./components/main-window/ClipTimer"
import TakeSnapshotForm from "./components/main-window/TakeSnapshotForm"
import ShowNodesStatus from "./components/main-window/ShowNodesStatus"
import ShowSelectedComponent from "./components/main-window/ShowSelectedComponent"
import ROVInformation from "./components/main-window/RovInformation"
import { Button } from "@/components/ui/button"
 import { TbLayoutBottombarCollapse, TbLayoutBottombarExpand, TbLayoutSidebarRightCollapse, TbLayoutSidebarRightExpand } from "react-icons/tb";

function App() {
  const [isCreateDiveDialogOpen, setIsCreateDiveDialogOpen] = useState(false)
  const [isEditDiveDialogOpen, setIsEditDiveDialogOpen] = useState(false)
  const [isDeleteDiveDialogOpen, setIsDeleteDiveDialogOpen] = useState(false)
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedDiveId, setSelectedDiveId] = useState<string | null>(null)
  const [isDiving, setIsDiving] = useState(false)
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false)
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false)
  const [isDeleteTaskSubmitting, setIsDeleteTaskSubmitting] = useState(false)
  const [isCreateNodeDialogOpen, setIsCreateNodeDialogOpen] = useState(false)
  const [isEditNodeDialogOpen, setIsEditNodeDialogOpen] = useState(false)
  const [isDeleteNodeDialogOpen, setIsDeleteNodeDialogOpen] = useState(false)
  const [isDeleteNodeSubmitting, setIsDeleteNodeSubmitting] = useState(false)
  // const [isDeleteNodeDialogOpen, setIsDeleteNodeDialogOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isStartSessionDialogOpen, setIsStartSessionDialogOpen] = useState(false)
  const [isStopSessionDialogOpen, setIsStopSessionDialogOpen] = useState(false)
  const [isPauseSessionDialogOpen, setIsPauseSessionDialogOpen] = useState(false)
  const [isStartClipDialogOpen, setIsStartClipDialogOpen] = useState(false)
  const [isStopClipDialogOpen, setIsStopClipDialogOpen] = useState(false)
  const [isTakeSnapshotDialogOpen, setIsTakeSnapshotDialogOpen] = useState(false)
  const [recordingState, setRecordingState] = useState({ isRecordingStarted: false, isRecordingPaused: false, isRecordingStopped: false, isClipRecordingStarted: false })
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isLogsCollapsed, setIsLogsCollapsed] = useState(false)
  const [isDeviceCollapsed, setIsDeviceCollapsed] = useState(false)

  // WebSocket connections per overlay channel to broadcast project details
  const socketsRef = useRef<Record<number, WebSocket | null>>({})
  const WS_HOST = '127.0.0.1'
  const WS_PORT = 3620

  function getSocket(channelIndex: number): WebSocket | null {
    const existing = socketsRef.current[channelIndex]
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing
    }
    try {
      const ws = new WebSocket(`ws://${WS_HOST}:${WS_PORT}/overlay?ch=${channelIndex}`)
      ws.addEventListener('close', () => {
        try { if (socketsRef.current[channelIndex] === ws) socketsRef.current[channelIndex] = null } catch { }
      })
      ws.addEventListener('error', () => { try { /* ignore */ } catch { } })
      socketsRef.current[channelIndex] = ws
      return ws
    } catch {
      return existing ?? null
    }
  }

  function broadcastProject(details: { name?: string | null; client?: string | null; vessel?: string | null; location?: string | null; contractor?: string | null } | null) {
    const safe = details || {}
    const payload = JSON.stringify({
      project: {
        name: typeof safe.name === 'string' ? safe.name : null,
        client: typeof safe.client === 'string' ? safe.client : null,
        vessel: typeof safe.vessel === 'string' ? safe.vessel : null,
        location: typeof safe.location === 'string' ? safe.location : null,
        contractor: typeof safe.contractor === 'string' ? safe.contractor : null,
      }
    })
    for (const ch of [1, 2, 3, 4]) {
      try {
        const ws = getSocket(ch)
        if (!ws || typeof (ws as any).send !== 'function') continue
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload)
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.addEventListener('open', () => { try { ws.send(payload) } catch { } }, { once: true })
        }
      } catch { }
    }
  }

  const isSessionActionDisabled = !(
    selectedProjectId && selectedTaskId && selectedDiveId && selectedNodeId
  )

  const isStartSessionDisabled = (!isDiving) || !(
    selectedTaskId && selectedDiveId && selectedNodeId
  )

  useEffect(() => {
    let done = false
      ; (async () => {
        try {
          const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
          if (!done && res?.ok) setSelectedProjectId(res.data ?? null)
          const d = await window.ipcRenderer.invoke('app:getSelectedDiveId')
          if (!done && d?.ok) setSelectedDiveId(d.data ?? null)
          const t = await window.ipcRenderer.invoke('app:getSelectedTaskId')
          if (!done && t?.ok) setSelectedTaskId(t.data ?? null)
          const n = await window.ipcRenderer.invoke('app:getSelectedNodeId')
          if (!done && n?.ok) setSelectedNodeId(n.data ?? null)
        } catch { }
      })()
    const onChanged = (e: any) => {
      try {
        const id = e?.detail ?? null
        setSelectedProjectId(id)
          ; (async () => {
            try {
              if (id) {
                const det = await window.ipcRenderer.invoke('db:getSelectedProjectDetails', id)
                const p = det?.ok ? (det.data ?? null) : null
                if (p) broadcastProject({ name: p.name ?? null, client: p.client ?? null, vessel: p.vessel ?? null, location: p.location ?? null, contractor: p.contractor ?? null })
                else broadcastProject({ name: null, client: null, vessel: null, location: null, contractor: null })
              } else {
                broadcastProject({ name: null, client: null, vessel: null, location: null, contractor: null })
              }
            } catch {
              broadcastProject({ name: null, client: null, vessel: null, location: null, contractor: null })
            }
          })()
      } catch { }
    }
    const onDiveChanged = (e: any) => {
      try {
        const id = e?.detail ?? null
        setSelectedDiveId(id)
      } catch { }
    }
    const onTaskChanged = (e: any) => {
      try {
        const id = e?.detail ?? null
        setSelectedTaskId(id)
      } catch { }
    }
    const onNodeChanged = (e: any) => {
      try {
        const id = e?.detail ?? null
        setSelectedNodeId(id)
      } catch { }
    }
    window.addEventListener('selectedProjectChanged', onChanged as any)
    window.addEventListener('selectedDiveChanged', onDiveChanged as any)
    window.addEventListener('selectedTaskChanged', onTaskChanged as any)
    window.addEventListener('selectedNodeChanged', onNodeChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedProjectChanged', onChanged as any)
      window.removeEventListener('selectedDiveChanged', onDiveChanged as any)
      window.removeEventListener('selectedTaskChanged', onTaskChanged as any)
      window.removeEventListener('selectedNodeChanged', onNodeChanged as any)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const res = await window.ipcRenderer.invoke('recording:getState')
          if (!cancelled && res?.ok) setRecordingState(res.data)
          try {
            const muted = await window.ipcRenderer.invoke('obs:get-audio-input-muted')
            if (!cancelled && typeof muted === 'boolean') setIsMicMuted(muted)
          } catch { }
        } catch { }
      })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onRecordingStateChanged = () => {
      ; (async () => {
        try {
          const res = await window.ipcRenderer.invoke('recording:getState')
          if (res?.ok) setRecordingState(res.data)
        } catch { }
      })()
    }
    window.addEventListener('recordingStateChanged', onRecordingStateChanged as any)
    return () => window.removeEventListener('recordingStateChanged', onRecordingStateChanged as any)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!selectedDiveId) {
        setIsDiving(false)
        return
      }
      try {
        const res = await window.ipcRenderer.invoke('dive:isStarted', selectedDiveId)
        if (!cancelled) setIsDiving(!!(res?.ok && res.data === true))
      } catch {
        if (!cancelled) setIsDiving(false)
      }
    }
    load()
    const onDivesChanged = () => load()
    window.addEventListener('divesChanged', onDivesChanged as any)
    return () => {
      cancelled = true
      window.removeEventListener('divesChanged', onDivesChanged as any)
    }
  }, [selectedDiveId])

  async function onConfirmDeleteDive() {
    if (!selectedDiveId) return
    try {
      setIsDeleteSubmitting(true)
      const res = await window.ipcRenderer.invoke('db:deleteDive', selectedDiveId)
      if (!res?.ok) {
        return
      }
      try { await window.ipcRenderer.invoke('app:setSelectedDiveId', null) } catch {}
      try {
        const ev1 = new CustomEvent('selectedDiveChanged', { detail: null })
        window.dispatchEvent(ev1)
      } catch {}
      try {
        const ev2 = new Event('divesChanged')
        window.dispatchEvent(ev2)
      } catch {}
      setIsDeleteDiveDialogOpen(false)
    } finally {
      setIsDeleteSubmitting(false)
    }
  }
  async function onConfirmDeleteTask() {
    if (!selectedTaskId) return
    try {
      setIsDeleteTaskSubmitting(true)
      const res = await window.ipcRenderer.invoke('db:deleteTask', selectedTaskId)
      if (!res?.ok) {
        return
      }
      try { await window.ipcRenderer.invoke('app:setSelectedTaskId', null) } catch {}
      try {
        const ev1 = new CustomEvent('selectedTaskChanged', { detail: null })
        window.dispatchEvent(ev1)
      } catch {}
      try {
        const ev2 = new Event('tasksChanged')
        window.dispatchEvent(ev2)
      } catch {}
      setIsDeleteTaskDialogOpen(false)
    } finally {
      setIsDeleteTaskSubmitting(false)
    }
  }
  async function onConfirmDeleteNode() {
    if (!selectedNodeId) return
    try {
      setIsDeleteNodeSubmitting(true)
      let parentId: string | null = null
      try {
        const det = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', selectedNodeId)
        parentId = det?.ok ? (det.data?.parentId ?? null) : null
      } catch {}
      const res = await window.ipcRenderer.invoke('db:deleteNode', selectedNodeId)
      if (!res?.ok) {
        return
      }
      try { await window.ipcRenderer.invoke('app:setSelectedNodeId', null) } catch {}
      try {
        const evSel = new CustomEvent('selectedNodeChanged', { detail: null })
        window.dispatchEvent(evSel)
      } catch {}
      try {
        const pidRes = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        const pid: string | null = pidRes?.ok ? (pidRes.data ?? null) : null
        if (pid) {
          await window.ipcRenderer.invoke('db:editProject', pid, { lastSelectedNodeId: null })
        }
      } catch {}
      try {
        const ev = new CustomEvent('nodesChanged', { detail: { id: selectedNodeId, parentId, action: 'deleted' } })
        window.dispatchEvent(ev)
      } catch {}
      setIsDeleteNodeDialogOpen(false)
    } finally {
      setIsDeleteNodeSubmitting(false)
    }
  }
  return (
    <div className='h-screen flex flex-col bg-[#1A1E25]'>
      <AppWindowBar />
      <div className="flex-1 flex">
        <div className="flex-none flex flex-col h-full w-[300px] border-r border-slate-700">
          <Tabs defaultValue="workpack" className="h-full">
            <TabsList>
              <TabsTrigger value="workpack">Workpack</TabsTrigger>
            </TabsList>
            <TabsContent value="workpack" className="flex flex-col gap-2 h-full">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Dive</span>
                  <div className="flex gap-1">
                    <button
                      title="Add Dive"
                      disabled={!selectedProjectId || isDiving}
                      onClick={() => setIsCreateDiveDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5  disabled:opacity-30 disabled:pointer-events-none">
                      <MdAdd className="h-5 w-5 text-slate-400" />
                    </button>
                    <button
                      title="Edit Dive"
                      disabled={!selectedProjectId || !selectedDiveId || isDiving}
                      onClick={() => setIsEditDiveDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5  disabled:opacity-30 disabled:pointer-events-none">
                      <MdEdit className="h-4 w-4 text-slate-400" />
                    </button>
                    <button
                      title="Remove Dive"
                      disabled={!selectedProjectId || !selectedDiveId || isDiving}
                      onClick={() => setIsDeleteDiveDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5  disabled:opacity-30 disabled:pointer-events-none">
                      <MdDelete className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                <DiveSelection />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">Dive Remarks</span>
                <ShowDiveRemarks />
              </div>
              <div className="h-[1px] bg-slate-700" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Task</span>
                  <div className="flex gap-1">
                    <button
                      title="Add Task"
                      disabled={!selectedProjectId || !selectedTaskId || recordingState.isRecordingStarted || isDiving}
                      onClick={() => setIsCreateTaskDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5  disabled:opacity-30 disabled:pointer-events-none">
                      <MdAdd className="h-5 w-5 text-slate-400" />
                    </button>
                    <button
                      title="Edit Task"
                      disabled={!selectedProjectId || !selectedDiveId || isDiving}
                      onClick={() => setIsEditTaskDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5  disabled:opacity-30 disabled:pointer-events-none">
                      <MdEdit className="h-4 w-4 text-slate-400" />
                    </button>
                    <button
                      title="Remove Task"
                      disabled={!selectedProjectId || !selectedDiveId || isDiving}
                      onClick={() => setIsDeleteTaskDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5  disabled:opacity-30 disabled:pointer-events-none">
                      <MdDelete className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                <TaskSelection />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">Task Remarks</span>
                <ShowTaskRemarks />
              </div>
              <div className="h-[1px] bg-slate-700" />
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">Node Remarks</span>
                <ShowNodesRemarks />
              </div>
              <div className="h-full flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Nodes</span>
                  <div className="flex gap-1">
                    <button
                      title="Add Node(s)"
                      disabled={!selectedProjectId || recordingState.isRecordingStarted}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => setIsCreateNodeDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5  disabled:opacity-30 disabled:pointer-events-none">
                      <MdAdd className="h-5 w-5 text-slate-400" />
                    </button>
                    <button
                      title="Edit Node"
                      disabled={!selectedProjectId || !selectedNodeId || recordingState.isRecordingStarted}
                      onClick={() => setIsEditNodeDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none">
                      <MdEdit className="h-4 w-4 text-slate-400" />
                    </button>
                    <button
                      title="Remove Node"
                      disabled={!selectedProjectId || !selectedNodeId || recordingState.isRecordingStarted}
                      onClick={() => setIsDeleteNodeDialogOpen(true)}
                      className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none">
                      <MdDelete className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                <NodesTree />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 border-b border-slate-700">
            <Tabs defaultValue="preview" className="h-full">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="flex flex-col p-0">
                <div className="flex-none w-full h-[37px] bg-[#363D4A] flex items-center px-1 gap-1.5">
                  <StartDiveButton/>
                  <button
                    title="Start Session"
                    disabled={isStartSessionDisabled || recordingState.isRecordingStarted}
                    onClick={() => setIsStartSessionDialogOpen(true)}
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[120px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                    <FaCircle className="h-4 w-4" fill="#E06061" />
                    <span className="text-slate-400">Start Session</span>
                  </button>
                  <button
                    title="Stop Session"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted || recordingState.isRecordingStopped}
                    onClick={() => setIsStopSessionDialogOpen(true)}
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[120px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                    <FaStop className="h-4 w-4" fill="#DE4D3A" />
                    <span className="text-slate-400">Stop Session</span>
                  </button>
                  <button
                    title="Pause Session"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted || recordingState.isRecordingPaused || recordingState.isRecordingStopped}
                    onClick={() => setIsPauseSessionDialogOpen(true)}
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[120px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                    <FaPause className="h-4 w-4" fill="#E0CC5F" />
                    <span className="text-slate-400">Pause Session</span>
                  </button>
                  <button
                    title="Resume Session"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted || !recordingState.isRecordingPaused || recordingState.isRecordingStopped}
                    onClick={() => { try { window.ipcRenderer.invoke('obs:resume-recording'); window.ipcRenderer.invoke('recording:updateState', { isRecordingPaused: false }); setRecordingState(prev => ({ ...prev, isRecordingPaused: false })); window.dispatchEvent(new Event('recordingStateChanged')); (async () => { try { const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId'); const projectId = proj?.ok ? (proj.data ?? null) : null; if (projectId) { const [diveRes, taskRes, nodeRes, fmt] = await Promise.all([window.ipcRenderer.invoke('app:getSelectedDiveId'), window.ipcRenderer.invoke('app:getSelectedTaskId'), window.ipcRenderer.invoke('app:getSelectedNodeId'), window.ipcRenderer.invoke('obs:get-file-name-formatting').catch(() => null),]); const diveId = diveRes?.ok ? (diveRes.data ?? null) : null; const taskId = taskRes?.ok ? (taskRes.data ?? null) : null; const nodeId = nodeRes?.ok ? (nodeRes.data ?? null) : null; let diveName = ''; let taskName = ''; let nodeName = ''; try { if (diveId) { const d = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', diveId); diveName = d?.ok ? (d.data?.name ?? '') : '' } } catch { } try { if (taskId) { const t = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', taskId); taskName = t?.ok ? (t.data?.name ?? '') : '' } } catch { } try { if (nodeId) { const n = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId); nodeName = n?.ok ? (n.data?.name ?? '') : '' } } catch { } const fileNames: string[] = []; try { const previewFmt = fmt && typeof fmt.preview === 'string' ? fmt.preview : ''; const ch1Fmt = fmt && typeof fmt.ch1 === 'string' ? fmt.ch1 : ''; const ch2Fmt = fmt && typeof fmt.ch2 === 'string' ? fmt.ch2 : ''; const ch3Fmt = fmt && typeof fmt.ch3 === 'string' ? fmt.ch3 : ''; const ch4Fmt = fmt && typeof fmt.ch4 === 'string' ? fmt.ch4 : ''; if (previewFmt) fileNames.push(previewFmt); if (ch1Fmt) fileNames.push(ch1Fmt); if (ch2Fmt) fileNames.push(ch2Fmt); if (ch3Fmt) fileNames.push(ch3Fmt); if (ch4Fmt) fileNames.push(ch4Fmt); } catch { } await window.ipcRenderer.invoke('db:addProjectLog', { projectId, event: 'Recording Resumed', dive: diveName || null, task: taskName || null, components: nodeName ? `(${nodeName})` : null, fileName: fileNames.length ? fileNames.join(', ') : null, }); try { window.dispatchEvent(new Event('projectLogsChanged')) } catch { } } } catch { } })() } catch { } }}
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[130px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                    <FaPlay className="h-4 w-4" fill="#93E05F" />
                    <span className="text-slate-400">Resume Session</span>
                  </button>
                  <SessionTimer />
                  <div className="h-[30px] w-[1px] bg-white/20 mx-1" />
                  <button
                    title="Start Clip"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted || recordingState.isClipRecordingStarted}
                    onClick={() => {
                      ; (async () => {
                        try { await window.ipcRenderer.invoke('obs:start-clip-recording') } catch { }
                        try { await window.ipcRenderer.invoke('recording:updateState', { isClipRecordingStarted: true }) } catch { }
                        try { setRecordingState(prev => ({ ...prev, isClipRecordingStarted: true })) } catch { }
                        try { window.dispatchEvent(new Event('recordingStateChanged')) } catch { }
                        // Add project log: Clip Started (best-effort)
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
                            try { if (diveId) { const d = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', diveId); diveName = d?.ok ? (d.data?.name ?? '') : '' } } catch { }
                            try { if (taskId) { const t = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', taskId); taskName = t?.ok ? (t.data?.name ?? '') : '' } } catch { }
                            try { if (nodeId) { const n = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId); nodeName = n?.ok ? (n.data?.name ?? '') : '' } } catch { }
                            let clipFileName = ''
                            try {
                              const fmt = await window.ipcRenderer.invoke('obs:get-clip-file-name-formatting')
                              clipFileName = typeof fmt === 'string' ? fmt : ''
                            } catch { }
                            try {
                              await window.ipcRenderer.invoke('db:addProjectLog', {
                                projectId,
                                event: 'Clip Started',
                                dive: diveName || null,
                                task: taskName || null,
                                components: nodeName ? `(${nodeName})` : null,
                                fileName: clipFileName || null,
                              })
                              window.dispatchEvent(new Event('projectLogsChanged'))
                            } catch { }
                          }
                        } catch { }
                      })()
                    }}
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[90px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                    <MdCameraRoll className="h-4 w-4" />
                    <span className="text-slate-400">Start Clip</span>
                  </button>
                  <button
                    title="Stop Clip"
                    disabled={isSessionActionDisabled || !recordingState.isClipRecordingStarted}
                    onClick={() => setIsStopClipDialogOpen(true)}
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[90px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                    <FaStop className="h-4 w-4" />
                    <span className="text-slate-400">Stop Clip</span>
                  </button>
                  <ClipTimer />
                  <div className="h-[30px] w-[1px] bg-white/20 mx-1" />
                  <button
                    title="Take Snapshot"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted}
                    onClick={() => setIsTakeSnapshotDialogOpen(true)}
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[110px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                    <BsCameraFill className="h-4 w-4" />
                    <span className="text-slate-400">Take Snapshot</span>
                  </button>
                </div>
                <div className="flex-1 bg-black">
                  <PreviewVirtualCam />
                </div>
                <div className="flex-none w-full h-[37px] bg-[#363D4A] flex items-center px-1 gap-1.5">
                  <CursorToolButton />
                  <FreeDrawToolButton />
                  <ArrowDrawingTool />
                  <CircleDrawingTool />
                  <div className="h-[30px] w-[1px] bg-white/20 mx-1" />
                  <button
                    title="Mute Microphone"
                    onClick={async () => {
                      try {
                        const ok = await window.ipcRenderer.invoke('obs:toggle-audio-input-mute')
                        if (ok) {
                          try {
                            const muted = await window.ipcRenderer.invoke('obs:get-audio-input-muted')
                            if (typeof muted === 'boolean') setIsMicMuted(muted)
                          } catch { }
                        }
                      } catch { }
                    }}
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[150px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                    {isMicMuted ? <FaMicrophoneSlash className="h-4 w-4" /> : <FaMicrophone className="h-4 w-4" />}
                    <span className="text-slate-400">{isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}</span>
                  </button>
                  <AudioMeterLive muted={isMicMuted} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className={`flex-none ${isLogsCollapsed ? 'h-[32px]' : 'h-[285px]'} overflow-hidden w-full`}>
            <Tabs defaultValue="logs" className="h-full">
              <TabsList className="w-full">
                <TabsTrigger value="logs" className={`${isLogsCollapsed ? 'hidden' : ''}`}>Logs</TabsTrigger>
                <TabsTrigger value="ROV Information" className={`${isLogsCollapsed ? 'hidden' : ''}`}>ROV Information</TabsTrigger>
                <div className="w-full flex items-center justify-end h-[32px]">
                  <button 
                    title={isLogsCollapsed ? 'Expand' : 'Collapse'}
                    onClick={() => setIsLogsCollapsed(prev => !prev)} 
                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none mr-2">
                    {isLogsCollapsed ? <TbLayoutBottombarExpand className="h-4 w-4 text-slate-400"/> : <TbLayoutBottombarCollapse className="h-4 w-4 text-slate-400"/>}
                  </button>
                </div>
              </TabsList>
              <TabsContent value="logs" className="p-0">
                <AllLogsTable />
              </TabsContent>
              <TabsContent value="ROV Information" className="p-0">
                <ROVInformation />
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <div className={`flex-none h-full ${isDeviceCollapsed ? 'w-[40px]' : 'w-[300px]'} border-l border-slate-700`}>
          <Tabs defaultValue="device" className="h-full">
            <TabsList className="w-full">
              <TabsTrigger value="device" className={`${isDeviceCollapsed ? 'hidden' : ''}`}>Device</TabsTrigger>
              <div className={`w-full flex items-center justify-end ${isDeviceCollapsed ? 'mt-1' : ''}`}>
                <button
                  title={isDeviceCollapsed ? 'Expand' : 'Collapse'}
                  onClick={() => setIsDeviceCollapsed(prev => !prev)}
                  className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none mr-2">
                  {isDeviceCollapsed ? (
                    <TbLayoutSidebarRightExpand className="h-4 w-4 text-slate-400" />
                  ) : (
                    <TbLayoutSidebarRightCollapse className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </TabsList>
            <TabsContent value="device" className={`flex flex-col gap-2 ${isDeviceCollapsed ? 'hidden' : ''}`}>
                <ChannelViewList />
                <div className="h-[1px] bg-slate-700" />
                <ChannelOverlaySelection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <DraggableDialog open={isCreateDiveDialogOpen} onOpenChange={setIsCreateDiveDialogOpen} title="Add New Dive">
        <AddNewDive onClose={() => setIsCreateDiveDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isEditDiveDialogOpen} onOpenChange={setIsEditDiveDialogOpen} title="Edit Dive">
        <EditDiveForm onClose={() => setIsEditDiveDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen} title="New Task">
        <CreateTaskForm onClose={() => setIsCreateTaskDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen} title="Edit Task">
        <EditTaskForm onClose={() => setIsEditTaskDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isCreateNodeDialogOpen} onOpenChange={setIsCreateNodeDialogOpen} title="New Node">
        <AddNewNodeForm onClose={() => setIsCreateNodeDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isEditNodeDialogOpen} onOpenChange={setIsEditNodeDialogOpen} title="Edit Node">
        <EditNodeDetailsForm onClose={() => setIsEditNodeDialogOpen(false)} />
      </DraggableDialog>
      {/* Delete Node dialog removed */}
      <DraggableDialog open={isStartSessionDialogOpen} onOpenChange={setIsStartSessionDialogOpen} title="Start Session">
        <StartSessionForm onClose={() => setIsStartSessionDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isStopSessionDialogOpen} onOpenChange={setIsStopSessionDialogOpen} title="Stop Session">
        <StopSessionForm onClose={() => setIsStopSessionDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isPauseSessionDialogOpen} onOpenChange={setIsPauseSessionDialogOpen} title="Pause Session">
        <PauseSessionForm onClose={() => setIsPauseSessionDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isStartClipDialogOpen} onOpenChange={setIsStartClipDialogOpen} title="Start Clip">
        <StartClipRecordingForm onClose={() => setIsStartClipDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isStopClipDialogOpen} onOpenChange={setIsStopClipDialogOpen} title="Stop Clip">
        <StopClipRecordingForm onClose={() => setIsStopClipDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isTakeSnapshotDialogOpen} onOpenChange={setIsTakeSnapshotDialogOpen} title="Take Snapshot">
        <TakeSnapshotForm onClose={() => setIsTakeSnapshotDialogOpen(false)} />
      </DraggableDialog>
      <DraggableDialog open={isDeleteDiveDialogOpen} onOpenChange={setIsDeleteDiveDialogOpen} title="Remove Dive">
        <div className="flex flex-col gap-4">
          <div className="text-slate-400">
            Are you sure you want to remove this dive?
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsDeleteDiveDialogOpen(false)} disabled={isDeleteSubmitting}>Cancel</Button>
            <Button onClick={onConfirmDeleteDive} disabled={isDeleteSubmitting || !selectedDiveId}>Delete</Button>
          </div>
        </div>
      </DraggableDialog>
      <DraggableDialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen} title="Remove Task">
        <div className="flex flex-col gap-4">
          <div className="text-slate-400">
            Are you sure you want to remove this task?
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsDeleteTaskDialogOpen(false)} disabled={isDeleteTaskSubmitting}>Cancel</Button>
            <Button onClick={onConfirmDeleteTask} disabled={isDeleteTaskSubmitting || !selectedTaskId}>Delete</Button>
          </div>
        </div>
      </DraggableDialog>
      <DraggableDialog open={isDeleteNodeDialogOpen} onOpenChange={setIsDeleteNodeDialogOpen} title="Remove Node">
        <div className="flex flex-col gap-4">
          <div className="text-slate-400">
            Are you sure you want to remove this node?
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsDeleteNodeDialogOpen(false)} disabled={isDeleteNodeSubmitting}>Cancel</Button>
            <Button onClick={onConfirmDeleteNode} disabled={isDeleteNodeSubmitting || !selectedNodeId}>Delete</Button>
          </div>
        </div>
      </DraggableDialog>
    </div>
  )
}

export default App
