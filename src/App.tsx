import { useState } from "react"
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

function App() {
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [isOpenProjectOpen, setIsOpenProjectOpen] = useState(false)
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
          <Input placeholder='Project name' />
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button onClick={() => setIsNewProjectOpen(false)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* open project dialog */}
      <Dialog open={isOpenProjectOpen} onOpenChange={setIsOpenProjectOpen}>
        <DialogContent>
          <DialogHeader className='-m-6 mb-2 p-4 border-b'>
            <DialogTitle>Open Project</DialogTitle>
            <DialogDescription>Select a project to open.</DialogDescription>
          </DialogHeader>
          <Input placeholder='Project path or name' />
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button onClick={() => setIsOpenProjectOpen(false)}>Open</Button>
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
                <Dialog>
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
                    <Input />
                    <DialogFooter>
                      <DialogClose>cancel</DialogClose>
                      <Button type="submit">Confirm</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button size={'sm'}>
                  Edit Dive
                </Button>
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
                <Button size={'sm'}>
                  New Task
                </Button>
                <Button size={'sm'}>
                  Edit Task
                </Button>
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
                <Button size={'sm'}>
                  New Component
                </Button>
                <Button size={'sm'}>
                  Edit Component
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

        </div>
      </div>
    </div>
  )
}

export default App
