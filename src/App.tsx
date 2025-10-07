import AppWindowBar from "./components/main-window/AppWindowBar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DraggableDialog } from "@/components/ui/draggable-dialog"
import AddNewDive from "./components/main-window/AddNewDiveForm"
import { useEffect, useRef, useState } from "react"
import { BiPlus } from "react-icons/bi";
import { MdCameraRoll, MdEdit } from "react-icons/md";
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
import { FaCircle, FaMicrophone, FaPause, FaPlay, FaStop } from "react-icons/fa"
import { BsCameraFill } from "react-icons/bs";
import AudioMeter from "./components/main-window/AudioMeter"
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

function App() {
  const [isCreateDiveDialogOpen, setIsCreateDiveDialogOpen] = useState(false)
  const [isEditDiveDialogOpen, setIsEditDiveDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedDiveId, setSelectedDiveId] = useState<string | null>(null)
  const [isDiving, setIsDiving] = useState(false)
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false)
  const [isCreateNodeDialogOpen, setIsCreateNodeDialogOpen] = useState(false)
  const [isEditNodeDialogOpen, setIsEditNodeDialogOpen] = useState(false)
  // const [isDeleteNodeDialogOpen, setIsDeleteNodeDialogOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isStartSessionDialogOpen, setIsStartSessionDialogOpen] = useState(false)
  const [isStopSessionDialogOpen, setIsStopSessionDialogOpen] = useState(false)
  const [isPauseSessionDialogOpen, setIsPauseSessionDialogOpen] = useState(false)
  const [isStartClipDialogOpen, setIsStartClipDialogOpen] = useState(false)
  const [isStopClipDialogOpen, setIsStopClipDialogOpen] = useState(false)
  const [isTakeSnapshotDialogOpen, setIsTakeSnapshotDialogOpen] = useState(false)
  const [recordingState, setRecordingState] = useState({ isRecordingStarted: false, isRecordingPaused: false, isRecordingStopped: false, isClipRecordingStarted: false })

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
  return (
    <div className='h-screen flex flex-col bg-[#1D2229]'>
      <AppWindowBar />
      <div className="flex-1 flex p-2 gap-1">
        <div className="flex-none flex flex-col gap-1 h-full w-[300px]">
          <Tabs defaultValue="dive">
            <TabsList>
              <TabsTrigger value="dive">Dive</TabsTrigger>
            </TabsList>
            <TabsContent value="dive" className="flex flex-col gap-1">
              <div className="flex gap-1">
                <StartDiveButton />
              </div>
              <div className="flex gap-1">
                <button 
                  title="New Dive" 
                  disabled={!selectedProjectId || isDiving} 
                  onClick={() => setIsCreateDiveDialogOpen(true)} 
                  className="flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                  <BiPlus className="h-5 w-5" />
                  <span className="font-medium">Add Dive</span>
                </button>
                <button 
                title="Edit Dive" 
                disabled={!selectedProjectId || !selectedDiveId || isDiving} 
                onClick={() => setIsEditDiveDialogOpen(true)} 
                className="flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                  <MdEdit className="h-4.5 w-4.5" />
                  <span className="font-medium">Edit Dive</span>
                </button>
              </div>
              <DiveSelection />
              <ShowDiveRemarks />
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="task">
            <TabsList>
              <TabsTrigger value="task">Task</TabsTrigger>
            </TabsList>
            <TabsContent value="task" className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button
                  title="New Task"
                  disabled={!selectedProjectId || recordingState.isRecordingStarted}
                  onClick={() => setIsCreateTaskDialogOpen(true)}
                  className="flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                  <BiPlus className="h-5 w-5" />
                  <span className="font-medium">Add Task</span>
                </button>
                <button
                  title="Edit Task"
                  disabled={!selectedProjectId || !selectedTaskId || recordingState.isRecordingStarted}
                  onClick={() => setIsEditTaskDialogOpen(true)}
                  className="flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                  <MdEdit className="h-4.5 w-4.5" />
                  <span className="font-medium">Edit Task</span>
                </button>
              </div>
              <TaskSelection />
              <ShowTaskRemarks />
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="workpack" className="h-full">
            <TabsList>
              <TabsTrigger value="workpack">Workpack</TabsTrigger>
            </TabsList>
            <TabsContent value="workpack" className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button 
                  title="New Node" 
                  disabled={!selectedProjectId || recordingState.isRecordingStarted} 
                  onMouseDown={(e) => e.preventDefault()} onClick={() => setIsCreateNodeDialogOpen(true)} 
                  className="flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                  <BiPlus className="h-5 w-5" />
                  <span className="font-medium">Add Item</span>
                </button>
                <button 
                  title="Edit Node" 
                  disabled={!selectedProjectId || !selectedNodeId || recordingState.isRecordingStarted} 
                  onClick={() => setIsEditNodeDialogOpen(true)} 
                  className="flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                  <MdEdit className="h-4.5 w-4.5" />
                  <span className="font-medium">Edit Item</span>
                </button>
              </div>
              <ShowSelectedComponent/>
              <ShowNodesRemarks />
              <ShowNodesStatus/>
              <div className="bg-[#21262E] p-1 h-full">
                <NodesTree />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex-1">
            <Tabs defaultValue="preview" className="h-full">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="flex flex-col p-0">
                <div className="flex-none w-full h-[37px] bg-[#363D4A] flex items-center px-1 gap-1.5">
                  <button
                    title="Start Session"
                    disabled={isStartSessionDisabled || recordingState.isRecordingStarted}
                    onClick={() => setIsStartSessionDialogOpen(true)}
                    className="flex items-center justify-center h-[28px] gap-1 px-2 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                    <FaCircle className="h-3.5 w-3.5" fill="#E06061" />
                    <span className="font-medium">Start Session</span>
                  </button>
                  <button
                    title="Stop Session"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted || recordingState.isRecordingStopped}
                    onClick={() => setIsStopSessionDialogOpen(true)}
                    className="flex items-center justify-center h-[28px] gap-1 px-2 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                    <FaStop className="h-3.5 w-3.5" fill="#DE4D3A" />
                    <span className="font-medium">Stop Session</span>
                  </button>
                  <button
                    title="Pause Session"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted || recordingState.isRecordingPaused || recordingState.isRecordingStopped}
                    onClick={() => setIsPauseSessionDialogOpen(true)}
                    className="flex items-center justify-center h-[28px] gap-1 px-2 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                    <FaPause className="h-3.5 w-3.5" fill="#E0CC5F" />
                    <span className="font-medium">Pause Session</span>
                  </button>
                  <button
                    title="Resume Session"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted || !recordingState.isRecordingPaused || recordingState.isRecordingStopped}
                    onClick={() => { try { window.ipcRenderer.invoke('obs:resume-recording'); window.ipcRenderer.invoke('recording:updateState', { isRecordingPaused: false }); setRecordingState(prev => ({ ...prev, isRecordingPaused: false })); window.dispatchEvent(new Event('recordingStateChanged')); (async () => { try { const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId'); const projectId = proj?.ok ? (proj.data ?? null) : null; if (projectId) { const [diveRes, taskRes, nodeRes, fmt] = await Promise.all([window.ipcRenderer.invoke('app:getSelectedDiveId'), window.ipcRenderer.invoke('app:getSelectedTaskId'), window.ipcRenderer.invoke('app:getSelectedNodeId'), window.ipcRenderer.invoke('obs:get-file-name-formatting').catch(() => null),]); const diveId = diveRes?.ok ? (diveRes.data ?? null) : null; const taskId = taskRes?.ok ? (taskRes.data ?? null) : null; const nodeId = nodeRes?.ok ? (nodeRes.data ?? null) : null; let diveName = ''; let taskName = ''; let nodeName = ''; try { if (diveId) { const d = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', diveId); diveName = d?.ok ? (d.data?.name ?? '') : '' } } catch { } try { if (taskId) { const t = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', taskId); taskName = t?.ok ? (t.data?.name ?? '') : '' } } catch { } try { if (nodeId) { const n = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId); nodeName = n?.ok ? (n.data?.name ?? '') : '' } } catch { } const fileNames: string[] = []; try { const previewFmt = fmt && typeof fmt.preview === 'string' ? fmt.preview : ''; const ch1Fmt = fmt && typeof fmt.ch1 === 'string' ? fmt.ch1 : ''; const ch2Fmt = fmt && typeof fmt.ch2 === 'string' ? fmt.ch2 : ''; const ch3Fmt = fmt && typeof fmt.ch3 === 'string' ? fmt.ch3 : ''; const ch4Fmt = fmt && typeof fmt.ch4 === 'string' ? fmt.ch4 : ''; if (previewFmt) fileNames.push(previewFmt); if (ch1Fmt) fileNames.push(ch1Fmt); if (ch2Fmt) fileNames.push(ch2Fmt); if (ch3Fmt) fileNames.push(ch3Fmt); if (ch4Fmt) fileNames.push(ch4Fmt); } catch { } await window.ipcRenderer.invoke('db:addProjectLog', { projectId, event: 'Recording Resumed', dive: diveName || null, task: taskName || null, components: nodeName ? `(${nodeName})` : null, fileName: fileNames.length ? fileNames.join(', ') : null, }); try { window.dispatchEvent(new Event('projectLogsChanged')) } catch { } } } catch { } })() } catch { } }}
                    className="flex items-center justify-center h-[28px] gap-1 px-2 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                    <FaPlay className="h-3.5 w-3.5" fill="#93E05F" />
                    <span className="font-medium">Resume Session</span>
                  </button>
                  <SessionTimer />
                  <div className="h-[30px] w-[1px] bg-white/20 mx-1" />
                  <button
                    title="Start Clip"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted || recordingState.isClipRecordingStarted}
                    onClick={() => setIsStartClipDialogOpen(true)}
                    className="flex items-center justify-center h-[28px] gap-1 px-2 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                    <MdCameraRoll className="h-3.5 w-3.5" />
                    <span className="font-medium">Start Clip</span>
                  </button>
                  <button
                    title="Stop Clip"
                    disabled={isSessionActionDisabled || !recordingState.isClipRecordingStarted}
                    onClick={() => setIsStopClipDialogOpen(true)}
                    className="flex items-center justify-center h-[28px] gap-1 px-2 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                    <FaStop className="h-3.5 w-3.5" />
                    <span className="font-medium">Stop Clip</span>
                  </button>
                  <ClipTimer />
                  <div className="h-[30px] w-[1px] bg-white/20 mx-1" />
                  <button
                    title="Take Snapshot"
                    disabled={isSessionActionDisabled || !recordingState.isRecordingStarted}
                    onClick={() => setIsTakeSnapshotDialogOpen(true)}
                    className="flex items-center justify-center h-[28px] gap-1 px-2 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                    <BsCameraFill className="h-4 w-4" />
                    <span className="font-medium">Take Snapshot</span>
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
                    disabled={isSessionActionDisabled}
                    className="flex items-center justify-center h-[28px] gap-1 px-2 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
                    <FaMicrophone className="h-4 w-4" />
                    <span className="font-medium">Mute Microphone</span>
                  </button>
                  <AudioMeter valueDb={-100} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex-none h-[250px] overflow-hidden w-full">
            <Tabs defaultValue="alllogs" className="h-full">
              <TabsList>
                <TabsTrigger value="alllogs">All Logs</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="alllogs" className="flex flex-col gap-1">
                <AllLogsTable />
              </TabsContent>
              <TabsContent value="events" className="flex flex-col gap-1">

              </TabsContent>
            </Tabs>
          </div>
        </div>
        <div className="flex-none h-full w-[300px]">
          <Tabs defaultValue="device" className="h-full">
            <TabsList>
              <TabsTrigger value="device">Device</TabsTrigger>
            </TabsList>
            <TabsContent value="device" className="flex flex-col gap-1">
              <ChannelViewList />
              <div className="w-full h-[1px] bg-white/20 my-2" />
              <ChannelOverlaySelection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <DraggableDialog open={isCreateDiveDialogOpen} onOpenChange={setIsCreateDiveDialogOpen} title="New Dive">
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
    </div>
  )
}

export default App
