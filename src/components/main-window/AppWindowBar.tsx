import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger,
} from "@/components/ui/menubar"
import { VscChromeMinimize, VscChromeClose } from "react-icons/vsc";
import { useEffect, useState } from "react";
import { DraggableDialog } from "@/components/ui/draggable-dialog";
import { Button } from "../ui/button";
import CreateProjectForm from "./CreateProjectForm";
import OpenProject from "./OpenProject";
import EditProjectDetailsForm from "./EditProjectDetailsForm";
import VideoDeviceConfigurations from "./VideoDeviceConfigurations";
import { FaRegWindowRestore } from "react-icons/fa";

export default function AppWindowBar() {
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
    const [newProjectOpen, setNewProjectOpen] = useState(false)
    const [openProjectOpen, setOpenProjectOpen] = useState(false)
    const [editProjectOpen, setEditProjectOpen] = useState(false)
    const [videoConfigOpen, setVideoConfigOpen] = useState(false)
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null)
    const [recentProjects, setRecentProjects] = useState<{ _id: string; name: string; lastSelectedDiveId?: string | null; lastSelectedTaskId?: string | null; lastSelectedNodeId?: string | null }[]>([])

    useEffect(() => {
        let done = false
            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                    if (!done && res?.ok) {
                        const id = res.data ?? null
                        setSelectedProjectId(id)
                        if (id) {
                            try {
                                const det = await window.ipcRenderer.invoke('db:getSelectedProjectDetails', id)
                                if (!done) setSelectedProjectName(det?.ok ? (det.data?.name ?? null) : null)
                            } catch {
                                if (!done) setSelectedProjectName(null)
                            }
                        } else if (!done) {
                            setSelectedProjectName(null)
                        }
                    }
                    // Load recent projects (top 5 by createdAt desc already from backend)
                    const all = await window.ipcRenderer.invoke('db:getAllProjects')
                    if (!done && all?.ok && Array.isArray(all.data)) {
                        const top5 = (all.data as any[]).slice(0, 5).map(p => ({ _id: p._id, name: p.name, lastSelectedDiveId: p.lastSelectedDiveId ?? null, lastSelectedTaskId: p.lastSelectedTaskId ?? null, lastSelectedNodeId: p.lastSelectedNodeId ?? null }))
                        setRecentProjects(top5)
                    } else if (!done) {
                        setRecentProjects([])
                    }
                } catch { }
            })()
        const onChanged = async (e: any) => {
            try {
                const id = e?.detail ?? null
                setSelectedProjectId(id)
                if (id) {
                    try {
                        const det = await window.ipcRenderer.invoke('db:getSelectedProjectDetails', id)
                        setSelectedProjectName(det?.ok ? (det.data?.name ?? null) : null)
                    } catch {
                        setSelectedProjectName(null)
                    }
                } else {
                    setSelectedProjectName(null)
                }
            } catch { }
        }
        window.addEventListener('selectedProjectChanged', onChanged as any)
        const onProjectsChanged = async () => {
            try {
                const all = await window.ipcRenderer.invoke('db:getAllProjects')
                if (all?.ok && Array.isArray(all.data)) {
                    const top5 = (all.data as any[]).slice(0, 5).map(p => ({ _id: p._id, name: p.name, lastSelectedDiveId: p.lastSelectedDiveId ?? null, lastSelectedTaskId: p.lastSelectedTaskId ?? null, lastSelectedNodeId: p.lastSelectedNodeId ?? null }))
                    setRecentProjects(top5)
                }
            } catch {}
        }
        window.addEventListener('projectsChanged', onProjectsChanged as any)
        return () => {
            done = true
            window.removeEventListener('selectedProjectChanged', onChanged as any)
            window.removeEventListener('projectsChanged', onProjectsChanged as any)
        }
    }, [])

    return (
        <div className='h-9 w-full drag flex items-center justify-between pl-2' >
            <div className="flex gap-2 w-full items-center">
                <div className="h-5 w-5 overflow-hidden rounded">
                    <img src="./dc.png" className="object-contain" />
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
                            <MenubarSub>
                                <MenubarSubTrigger>Open Recent Projects</MenubarSubTrigger>
                                <MenubarSubContent>
                                    {recentProjects.length === 0 ? (
                                        <MenubarItem data-disabled className="opacity-50">(none)</MenubarItem>
                                    ) : (
                                        recentProjects.map(p => (
                                            <MenubarItem key={p._id} onClick={async () => {
                                                try {
                                                    await window.ipcRenderer.invoke('app:setSelectedProjectId', p._id)
                                                    setSelectedProjectId(p._id)
                                                    setSelectedProjectName(p.name)
                                                    try {
                                                        const ev = new CustomEvent('selectedProjectChanged', { detail: p._id })
                                                        window.dispatchEvent(ev)
                                                    } catch { }
                                                    try {
                                                        await window.ipcRenderer.invoke('app:setSelectedDiveId', p.lastSelectedDiveId ?? null)
                                                        const ev2 = new CustomEvent('selectedDiveChanged', { detail: p.lastSelectedDiveId ?? null })
                                                        window.dispatchEvent(ev2)
                                                    } catch { }
                                                    try {
                                                        await window.ipcRenderer.invoke('app:setSelectedTaskId', p.lastSelectedTaskId ?? null)
                                                        const ev3 = new CustomEvent('selectedTaskChanged', { detail: p.lastSelectedTaskId ?? null })
                                                        window.dispatchEvent(ev3)
                                                    } catch { }
                                                    try {
                                                        await window.ipcRenderer.invoke('app:setSelectedNodeId', p.lastSelectedNodeId ?? null)
                                                        const ev4 = new CustomEvent('selectedNodeChanged', { detail: p.lastSelectedNodeId ?? null })
                                                        window.dispatchEvent(ev4)
                                                    } catch { }
                                                } catch { }
                                            }}>{p.name}</MenubarItem>
                                        ))
                                    )}
                                </MenubarSubContent>
                            </MenubarSub>

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
                                        setSelectedProjectName(null)
                                        try {
                                            const ev = new CustomEvent('selectedProjectChanged', { detail: null })
                                            window.dispatchEvent(ev)
                                            await window.ipcRenderer.invoke('app:setSelectedDiveId', null)
                                            try {
                                                const ev2 = new CustomEvent('selectedDiveChanged', { detail: null })
                                                window.dispatchEvent(ev2)
                                            // Clear selected task as well
                                            await window.ipcRenderer.invoke('app:setSelectedTaskId', null)
                                            try {
                                                const ev3 = new CustomEvent('selectedTaskChanged', { detail: null })
                                                window.dispatchEvent(ev3)
                                            } catch { }
                                                // Clear selected node as well
                                                await window.ipcRenderer.invoke('app:setSelectedNodeId', null)
                                                try {
                                                    const ev3 = new CustomEvent('selectedNodeChanged', { detail: null })
                                                    window.dispatchEvent(ev3)
                                                } catch { }
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
                    <MenubarMenu>
                        <MenubarTrigger className='px-2 py-1'>Settings</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={() => setVideoConfigOpen(true)}>Video Configurations</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger className='px-2 py-1'>Export</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={() => window.ipcRenderer.invoke('window:open-export-project')}>Export Project Settings</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>
            </div>
            <div className="w-full flex items-center relative top-1">
                <span>{selectedProjectName || ''}</span>
            </div>
            <div className='flex items-center gap-2 h-full'>
                <button
                    title="Minimize"
                    className='h-full w-12 no-drag flex items-center justify-center text-white hover:bg-white/15'
                    onClick={() => window.ipcRenderer.invoke('window:minimize')}
                >
                    <VscChromeMinimize className="h-4 w-4 text-white/50" />
                </button>
                <button
                    title="Restore/Maximize"
                    className='h-full w-12 no-drag flex items-center justify-center text-white hover:bg-white/15'
                    onClick={() => window.ipcRenderer.invoke('window:toggle-maximize')}
                >
                    <FaRegWindowRestore className="h-3 w-3 text-white/50" />
                </button>
                <button
                    title="Close Application"
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
            <DraggableDialog
                open={videoConfigOpen}
                onOpenChange={setVideoConfigOpen}
                title="Video Configurations"
                width={800}
            >
                <VideoDeviceConfigurations/>
            </DraggableDialog>
        </div >
    )
}