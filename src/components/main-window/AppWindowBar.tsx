import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarTrigger,
} from "@/components/ui/menubar"
import { VscChromeMinimize, VscChromeClose } from "react-icons/vsc";
import { useState } from "react";
import { DraggableDialog } from "@/components/ui/draggable-dialog";
import { Button } from "../ui/button";
import CreateProjectForm from "./CreateProjectForm";

export default function AppWindowBar() {
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
    const [newProjectOpen, setNewProjectOpen] = useState(false)
    const [openProjectOpen, setOpenProjectOpen] = useState(false)

    return (
        < div className='h-9 w-full drag flex items-center justify-between pl-2' >
            <Menubar className='no-drag h-6 bg-transparent border-0 p-0 shadow-none text-white'>
                <MenubarMenu>
                    <MenubarTrigger className='px-2 py-1'>File</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={() => setNewProjectOpen(true)}>
                            New Project
                        </MenubarItem>
                        <MenubarItem onClick={() => setOpenProjectOpen(true)}>
                            Open Project
                        </MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger className='px-2 py-1'>Settings</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem>Video</MenubarItem>
                        <MenubarItem>Audio</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>

            <div className='flex items-center gap-2 h-full'>
                <button
                    className='h-full w-12 no-drag flex items-center justify-center text-white hover:bg-white/15'
                    onClick={() => window.ipcRenderer.invoke('window:minimize')}
                >
                    <VscChromeMinimize className="h-4 w-4 text-white/50" />
                </button>
                <button
                    className='group h-full w-12 no-drag flex items-center justify-center text-white hover:bg-red-600'
                    onClick={() => setConfirmCloseOpen(true)}
                >
                    <VscChromeClose className="h-4 w-4 text-white/50 group-hover:text-white" />
                </button>
            </div>
            <DraggableDialog
                open={confirmCloseOpen}
                onOpenChange={setConfirmCloseOpen}
                title="Quit application?"
                width={420}
            >
                <div className="text-white/80">Are you sure you want to quit?</div>
                <div className="mt-4 flex justify-end gap-2">
                    <Button
                        onClick={() => setConfirmCloseOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => window.ipcRenderer.invoke('window:close')}
                    >
                        Quit
                    </Button>
                </div>
            </DraggableDialog>
            <DraggableDialog
                open={newProjectOpen}
                onOpenChange={setNewProjectOpen}
                title="New Project"
                width={520}
            >
                <CreateProjectForm onClose={() => setNewProjectOpen(false)} />
            </DraggableDialog>
            <DraggableDialog
                open={openProjectOpen}
                onOpenChange={setOpenProjectOpen}
                title="Open Project"
                width={520}
            />
        </div >
    )
}