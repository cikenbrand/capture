import AppWindowBar from "./components/main-window/AppWindowBar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DraggableDialog } from "@/components/ui/draggable-dialog"
import AddNewDive from "./components/main-window/AddNewDiveForm"
import { useEffect, useState } from "react"
import { BiPlus } from "react-icons/bi";
import { MdDelete, MdEdit } from "react-icons/md";
import DiveSelection from "./components/main-window/DiveSelection"
import EditDiveForm from "./components/main-window/EditDiveForm"
import ShowDiveRemarks from "./components/main-window/ShowDiveRemarks"
import StartDiveButton from "./components/main-window/StartDiveButton"
import StopDiveButton from "./components/main-window/StopDiveButton"
import CreateTaskForm from "./components/main-window/CreateTaskForm"
import TaskSelection from "./components/main-window/TaskSelection"
import EditTaskForm from "./components/main-window/EditTaskForm"
import ShowTaskRemarks from "./components/main-window/ShowTaskRemarks"
import NodesTree from "./components/main-window/NodesTree"
import AddNewNodeForm from "./components/main-window/AddNewNodeForm"
import EditNodeDetailsForm from "./components/main-window/EditNodeDetailsForm"

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
  const [isDeleteNodeDialogOpen, setIsDeleteNodeDialogOpen] = useState(false)

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
        } catch { }
      })()
    const onChanged = (e: any) => {
      try {
        const id = e?.detail ?? null
        setSelectedProjectId(id)
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
    window.addEventListener('selectedProjectChanged', onChanged as any)
    window.addEventListener('selectedDiveChanged', onDiveChanged as any)
    window.addEventListener('selectedTaskChanged', onTaskChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedProjectChanged', onChanged as any)
      window.removeEventListener('selectedDiveChanged', onDiveChanged as any)
      window.removeEventListener('selectedTaskChanged', onTaskChanged as any)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!selectedDiveId) {
        setIsDiving(false)
        return
      }
      try {
        const res = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', selectedDiveId)
        if (!cancelled) setIsDiving(!!(res?.ok && res.data && res.data.started))
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
      <div className="flex-1 flex p-2">
        <div className="flex-none flex flex-col gap-1 h-full w-[300px] border-r">
          <Tabs defaultValue="dive">
            <TabsList>
              <TabsTrigger value="dive">Dive</TabsTrigger>
            </TabsList>
            <TabsContent value="dive" className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button title="New Dive" disabled={!selectedProjectId || isDiving} onClick={() => setIsCreateDiveDialogOpen(true)} className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                  <BiPlus className="h-6 w-6" />
                </button>
                <button title="Edit Dive" disabled={!selectedProjectId || !selectedDiveId || isDiving} onClick={() => setIsEditDiveDialogOpen(true)} className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                  <MdEdit className="h-4.5 w-4.5" />
                </button>
                <StartDiveButton />
                <StopDiveButton />
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
                <button title="New Task" disabled={!selectedProjectId} onClick={() => setIsCreateTaskDialogOpen(true)} className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                  <BiPlus className="h-6 w-6" />
                </button>
                <button title="Edit Task" disabled={!selectedProjectId || !selectedTaskId} onClick={() => setIsEditTaskDialogOpen(true)} className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                  <MdEdit className="h-4.5 w-4.5" />
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
                <button title="New Node" disabled={!selectedProjectId} onMouseDown={(e) => e.preventDefault()} onClick={() => setIsCreateNodeDialogOpen(true)} className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                  <BiPlus className="h-6 w-6" />
                </button>
                <button title="Edit Node" disabled={!selectedProjectId} onClick={() => setIsEditNodeDialogOpen(true)} className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                  <MdEdit className="h-4.5 w-4.5" />
                </button>
                <button title="Delete Node" disabled={!selectedProjectId} onClick={() => setIsDeleteNodeDialogOpen(true)} className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                  <MdDelete className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="bg-[#21262E] p-1 h-full">
                <NodesTree/>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex-1">

        </div>
        <div className="flex-none h-full w-[300px] border-l">

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
      <DraggableDialog open={isDeleteNodeDialogOpen} onOpenChange={setIsDeleteNodeDialogOpen} title="Delete Node">
      </DraggableDialog>
    </div>
  )
}

export default App
