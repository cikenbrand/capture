import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarTrigger,
} from "@/components/ui/menubar"
import { VscChromeMinimize, VscChromeClose } from "react-icons/vsc";
import { useEffect, useState } from "react";
import { DraggableDialog } from "@/components/ui/draggable-dialog";
import { Button } from "../ui/button";
import CreateProjectForm from "./CreateProjectForm";
import OpenProject from "./OpenProject";
import EditProjectDetailsForm from "./EditProjectDetailsForm";

export default function AppWindowBar() {
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
    const [newProjectOpen, setNewProjectOpen] = useState(false)
    const [openProjectOpen, setOpenProjectOpen] = useState(false)
    const [editProjectOpen, setEditProjectOpen] = useState(false)
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

    useEffect(() => {
        let done = false
            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                    if (!done && res?.ok) setSelectedProjectId(res.data ?? null)
                } catch { }
            })()
        const onChanged = (e: any) => {
            try {
                const id = e?.detail ?? null
                setSelectedProjectId(id)
            } catch { }
        }
        window.addEventListener('selectedProjectChanged', onChanged as any)
        return () => {
            done = true
            window.removeEventListener('selectedProjectChanged', onChanged as any)
        }
    }, [])

    return (
        <div className='h-9 w-full drag flex items-center justify-between pl-2' >
            <div className="flex gap-2 w-full items-center">
                <div className="h-5 w-5 overflow-hidden rounded">
                    <img src="/dc.png" className="object-contain" />
                </div>
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
                            <MenubarSeparator />
                            <MenubarItem onClick={() => setEditProjectOpen(true)} disabled={!selectedProjectId}>
                                Edit Project
                            </MenubarItem>
                            <MenubarItem
                                disabled={!selectedProjectId}
                                onClick={async () => {
                                    try {
                                        await window.ipcRenderer.invoke('app:setSelectedProjectId', null)
                                        setSelectedProjectId(null)
                                        try {
                                            const ev = new CustomEvent('selectedProjectChanged', { detail: null })
                                            window.dispatchEvent(ev)
                                            await window.ipcRenderer.invoke('app:setSelectedDiveId', null)
                                            try {
                                                const ev2 = new CustomEvent('selectedDiveChanged', { detail: null })
                                                window.dispatchEvent(ev2)
                                            } catch { }
                                        } catch { }
                                    } catch { }
                                }}
                            >
                                Close Project
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger className='px-2 py-1'>Window</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={() => window.ipcRenderer.invoke('window:open-overlay-editor')}>Open Overlay Editor</MenubarItem>
                            <MenubarItem>Open Data Manager</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>
            </div>
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
                width={1220}
            >
                <OpenProject onClose={() => setOpenProjectOpen(false)} />
            </DraggableDialog>
            <DraggableDialog
                open={editProjectOpen}
                onOpenChange={setEditProjectOpen}
                title="Edit Project"
                width={800}
            >
                <EditProjectDetailsForm onClose={() => setEditProjectOpen(false)} />
            </DraggableDialog>
        </div >
    )
}