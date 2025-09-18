import { useEffect, useState } from "react"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "./components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "./components/ui/input"
import NodesTree from "./NodesTree"
import ProjectList from "./ProjectList"

function App() {
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [isOpenProjectOpen, setIsOpenProjectOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("")
  const [client, setClient] = useState("")
  const [contractor, setContractor] = useState("")
  const [vessel, setVessel] = useState("")
  const [location, setLocation] = useState("")
  const [projectType, setProjectType] = useState<"platform" | "pipeline" | undefined>(undefined)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [taskProjectId, setTaskProjectId] = useState("")
  const [taskName, setTaskName] = useState("")
  const [taskRemarks, setTaskRemarks] = useState("")
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false)
  const [editTaskId, setEditTaskId] = useState("")
  const [editTaskName, setEditTaskName] = useState("")
  const [editTaskRemarks, setEditTaskRemarks] = useState("")
  const [isNewDiveOpen, setIsNewDiveOpen] = useState(false)
  const [diveProjectId, setDiveProjectId] = useState("")
  const [diveName, setDiveName] = useState("")
  const [diveRemarks, setDiveRemarks] = useState("")
  const [isEditDiveOpen, setIsEditDiveOpen] = useState(false)
  const [editDiveId, setEditDiveId] = useState("")
  const [editDiveName, setEditDiveName] = useState("")
  const [editDiveRemarks, setEditDiveRemarks] = useState("")
  const [isNewNodeOpen, setIsNewNodeOpen] = useState(false)
  const [nodeProjectId, setNodeProjectId] = useState("")
  const [nodeName, setNodeName] = useState("")
  const [nodeParentId, setNodeParentId] = useState("")
  const [nodeRemarks, setNodeRemarks] = useState("")

  async function handleCreateProject() {
    if (!projectName || !client || !contractor || !vessel || !location || !projectType) {
      // rudimentary guard; you might want to show UI validation later
      return
    }
    const payload = {
      name: projectName,
      client,
      contractor,
      vessel,
      location,
      projectType,
    }
    const res = await window.ipcRenderer.invoke('db:createProject', payload)
    if (res?.ok) {
      // reset form and close
      setProjectName("")
      setClient("")
      setContractor("")
      setVessel("")
      setLocation("")
      setProjectType(undefined)
      setIsNewProjectOpen(false)
      // TODO: load projects list / navigate
    } else {
      console.error('Failed to create project:', res?.error)
    }
  }

  async function handleCreateDive() {
    if (!diveProjectId || !diveName) return
    const payload = {
      projectId: diveProjectId,
      name: diveName,
      remarks: diveRemarks || undefined,
    }
    const res = await window.ipcRenderer.invoke('db:createDive', payload)
    if (res?.ok) {
      setDiveProjectId("")
      setDiveName("")
      setDiveRemarks("")
      setIsNewDiveOpen(false)
    } else {
      console.error('Failed to create dive:', res?.error)
    }
  }

  async function handleEditDive() {
    if (!editDiveId) return
    const updates: { name?: string; remarks?: string } = {}
    if (editDiveName.trim()) updates.name = editDiveName
    if (editDiveRemarks.trim()) updates.remarks = editDiveRemarks
    if (!updates.name && !updates.remarks) return
    const res = await window.ipcRenderer.invoke('db:editDive', editDiveId, updates)
    if (res?.ok) {
      setEditDiveId("")
      setEditDiveName("")
      setEditDiveRemarks("")
      setIsEditDiveOpen(false)
    } else {
      console.error('Failed to edit dive:', res?.error)
    }
  }

  async function handleCreateTask() {
    if (!taskProjectId || !taskName) return
    const payload = {
      projectId: taskProjectId,
      name: taskName,
      remarks: taskRemarks || undefined,
    }
    const res = await window.ipcRenderer.invoke('db:createTask', payload)
    if (res?.ok) {
      setTaskProjectId("")
      setTaskName("")
      setTaskRemarks("")
      setIsNewTaskOpen(false)
    } else {
      console.error('Failed to create task:', res?.error)
    }
  }

  async function handleEditTask() {
    if (!editTaskId) return
    const updates: { name?: string; remarks?: string } = {}
    if (editTaskName.trim()) updates.name = editTaskName
    if (editTaskRemarks.trim()) updates.remarks = editTaskRemarks
    if (!updates.name && !updates.remarks) return
    const res = await window.ipcRenderer.invoke('db:editTask', editTaskId, updates)
    if (res?.ok) {
      setEditTaskId("")
      setEditTaskName("")
      setEditTaskRemarks("")
      setIsEditTaskOpen(false)
    } else {
      console.error('Failed to edit task:', res?.error)
    }
  }

  async function handleCreateNode() {
    if (!nodeProjectId || !nodeName) return
    const payload = {
      projectId: nodeProjectId,
      name: nodeName,
      parentId: nodeParentId || undefined,
      remarks: nodeRemarks || undefined,
    }
    const res = await window.ipcRenderer.invoke('db:createNode', payload)
    if (res?.ok) {
      setNodeProjectId("")
      setNodeName("")
      setNodeParentId("")
      setNodeRemarks("")
      setIsNewNodeOpen(false)
    } else {
      console.error('Failed to create node:', res?.error)
    }
  }
  
  return (
    <div className='h-screen flex flex-col'>
      {/* window bar */}
      <div className='h-8 w-full bg-black drag flex items-center justify-between px-2'>
        <Menubar className='no-drag h-6 bg-transparent border-0 p-0 shadow-none text-white'>
          <MenubarMenu>
            <MenubarTrigger className='px-2 py-1'>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setIsNewProjectOpen(true)}>
                New Project
              </MenubarItem>
              <MenubarItem onClick={() => setIsOpenProjectOpen(true)}>
                Open Project
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className='px-2 py-1'>Settings</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => console.log('Settings > Video')}>Video</MenubarItem>
              <MenubarItem onClick={() => console.log('Settings > Audio')}>Audio</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <div className='flex items-center gap-2'>
          <button
            className='no-drag px-2 py-1 text-white'
            onClick={() => window.ipcRenderer.invoke('window:minimize')}
          >
            Minimize
          </button>
          <button
            className='no-drag px-2 py-1 text-white'
            onClick={() => window.ipcRenderer.invoke('window:close')}
          >
            Close
          </button>
        </div>
      </div>
      {/* new project dialog */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent>
          <DialogHeader className='-m-6 mb-2 p-4 border-b'>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new project.</DialogDescription>
          </DialogHeader>
          <Input placeholder='Project name' value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <Input placeholder='Client name' value={client} onChange={(e) => setClient(e.target.value)} />
          <Input placeholder='Contractor name' value={contractor} onChange={(e) => setContractor(e.target.value)} />
          <Input placeholder='Vessel name' value={vessel} onChange={(e) => setVessel(e.target.value)} />
          <Input placeholder='Location name' value={location} onChange={(e) => setLocation(e.target.value)} />
          <Select value={projectType} onValueChange={(v: "platform" | "pipeline") => setProjectType(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose project type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="platform">Platform</SelectItem>
              <SelectItem value="pipeline">Pipeline</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button onClick={handleCreateProject}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* open project dialog */}
      <Dialog open={isOpenProjectOpen} onOpenChange={(open) => setIsOpenProjectOpen(open)}>
        <DialogContent>
          <DialogHeader className='-m-6 mb-2 p-4 border-b'>
            <DialogTitle>Open Project</DialogTitle>
            <DialogDescription>Select a project to open.</DialogDescription>
          </DialogHeader>
          <ProjectList
            selectedId={selectedProjectId}
            onChange={setSelectedProjectIdState}
            isOpen={isOpenProjectOpen}
          />
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button onClick={async () => {
              await window.ipcRenderer.invoke('app:setSelectedProjectId', selectedProjectId || null)
              setIsOpenProjectOpen(false)
            }} disabled={!selectedProjectId}>Open</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* body */}
      <div className="flex w-full h-full">
        <div className="h-full w-74 border-r">
          <Tabs defaultValue="workpack" className="h-full">
            <TabsList>
              <TabsTrigger value="workpack">Workpack</TabsTrigger>
            </TabsList>
            <TabsContent value="workpack" className="space-y-2">
              <div className="flex">
                {/* new dive */}
                <Dialog open={isNewDiveOpen} onOpenChange={setIsNewDiveOpen}>
                  <DialogTrigger asChild>
                    <Button size={'sm'}>
                      New Dive
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader className="-m-6 mb-2 p-4 border-b">
                      <DialogTitle>New Dive</DialogTitle>
                      <DialogDescription>Set up a new dive.</DialogDescription>
                    </DialogHeader>
                    <Input placeholder='Project ID' value={diveProjectId} onChange={(e) => setDiveProjectId(e.target.value)} />
                    <Input placeholder='Dive name' value={diveName} onChange={(e) => setDiveName(e.target.value)} />
                    <Input placeholder='Remarks' value={diveRemarks} onChange={(e) => setDiveRemarks(e.target.value)} />
                    <DialogFooter>
                      <DialogClose>cancel</DialogClose>
                      <Button onClick={handleCreateDive}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={isEditDiveOpen} onOpenChange={setIsEditDiveOpen}>
                  <DialogTrigger asChild>
                    <Button size={'sm'}>
                      Edit Dive
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader className='-m-6 mb-2 p-4 border-b'>
                      <DialogTitle>Edit Dive</DialogTitle>
                      <DialogDescription>Update dive name and/or remarks.</DialogDescription>
                    </DialogHeader>
                    <Input placeholder='Dive ID' value={editDiveId} onChange={(e) => setEditDiveId(e.target.value)} />
                    <Input placeholder='New name (optional)' value={editDiveName} onChange={(e) => setEditDiveName(e.target.value)} />
                    <Input placeholder='New remarks (optional)' value={editDiveRemarks} onChange={(e) => setEditDiveRemarks(e.target.value)} />
                    <DialogFooter>
                      <DialogClose>Cancel</DialogClose>
                      <Button onClick={handleEditDive}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex">
                <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
                  <DialogTrigger asChild>
                    <Button size={'sm'}>
                      New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader className='-m-6 mb-2 p-4 border-b'>
                      <DialogTitle>New Task</DialogTitle>
                      <DialogDescription>Create a new task for a project.</DialogDescription>
                    </DialogHeader>
                    <Input placeholder='Project ID' value={taskProjectId} onChange={(e) => setTaskProjectId(e.target.value)} />
                    <Input placeholder='Task name' value={taskName} onChange={(e) => setTaskName(e.target.value)} />
                    <Input placeholder='Remarks (optional)' value={taskRemarks} onChange={(e) => setTaskRemarks(e.target.value)} />
                    <DialogFooter>
                      <DialogClose>Cancel</DialogClose>
                      <Button onClick={handleCreateTask}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={isEditTaskOpen} onOpenChange={setIsEditTaskOpen}>
                  <DialogTrigger asChild>
                    <Button size={'sm'}>
                      Edit Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader className='-m-6 mb-2 p-4 border-b'>
                      <DialogTitle>Edit Task</DialogTitle>
                      <DialogDescription>Update task name and/or remarks.</DialogDescription>
                    </DialogHeader>
                    <Input placeholder='Task ID' value={editTaskId} onChange={(e) => setEditTaskId(e.target.value)} />
                    <Input placeholder='New name (optional)' value={editTaskName} onChange={(e) => setEditTaskName(e.target.value)} />
                    <Input placeholder='New remarks (optional)' value={editTaskRemarks} onChange={(e) => setEditTaskRemarks(e.target.value)} />
                    <DialogFooter>
                      <DialogClose>Cancel</DialogClose>
                      <Button onClick={handleEditTask}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex">
                <Dialog open={isNewNodeOpen} onOpenChange={setIsNewNodeOpen}>
                  <DialogTrigger asChild>
                    <Button size={'sm'}>
                      New Node
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader className='-m-6 mb-2 p-4 border-b'>
                      <DialogTitle>New Node</DialogTitle>
                      <DialogDescription>Create a node in a project's tree.</DialogDescription>
                    </DialogHeader>
                    <Input placeholder='Project ID' value={nodeProjectId} onChange={(e) => setNodeProjectId(e.target.value)} />
                    <Input placeholder='Node name' value={nodeName} onChange={(e) => setNodeName(e.target.value)} />
                    <Input placeholder='Parent node ID (optional)' value={nodeParentId} onChange={(e) => setNodeParentId(e.target.value)} />
                    <Input placeholder='Remarks (optional)' value={nodeRemarks} onChange={(e) => setNodeRemarks(e.target.value)} />
                    <DialogFooter>
                      <DialogClose>Cancel</DialogClose>
                      <Button onClick={handleCreateNode}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button size={'sm'}>
                  Edit Node
                </Button>
              </div>

            </TabsContent>
          </Tabs>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex-1">

          </div>
          <div className="flex-none h-64 w-full border-t">

          </div>
        </div>
        <div className="h-full w-74 border-l">
          <NodesTree projectId={selectedProjectId!}/>
        </div>
      </div>
    </div>
  )
}

export default App
