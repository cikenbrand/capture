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
import { toast } from "sonner";

export default function AppWindowBar() {
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
    const [newProjectOpen, setNewProjectOpen] = useState(false)
    const [openProjectOpen, setOpenProjectOpen] = useState(false)
    const [editProjectOpen, setEditProjectOpen] = useState(false)
    const [videoConfigOpen, setVideoConfigOpen] = useState(false)
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null)
    const [recentProjects, setRecentProjects] = useState<{ _id: string; name: string; lastSelectedDiveId?: string | null; lastSelectedTaskId?: string | null; lastSelectedNodeId?: string | null }[]>([])
    const [isRecordingStarted, setIsRecordingStarted] = useState(false)
    const [externalMonitors, setExternalMonitors] = useState<string[]>([])

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
            } catch { }
        }
        window.addEventListener('projectsChanged', onProjectsChanged as any)
        return () => {
            done = true
            window.removeEventListener('selectedProjectChanged', onChanged as any)
            window.removeEventListener('projectsChanged', onProjectsChanged as any)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('recording:getState')
                    if (!cancelled && res?.ok) setIsRecordingStarted(!!res.data?.isRecordingStarted)
                } catch { }
            })()
        const onChanged = async () => {
            try {
                const res = await window.ipcRenderer.invoke('recording:getState')
                if (res?.ok) setIsRecordingStarted(!!res.data?.isRecordingStarted)
            } catch { }
        }
        window.addEventListener('recordingStateChanged', onChanged as any)
        return () => {
            cancelled = true
            window.removeEventListener('recordingStateChanged', onChanged as any)
        }
    }, [])

    useEffect(() => {
        let done = false
            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('system:getExternalMonitors')
                    if (!done && res?.ok && Array.isArray(res.data)) {
                        setExternalMonitors(res.data as string[])
                    } else if (!done) {
                        setExternalMonitors([])
                    }
                } catch {
                    if (!done) setExternalMonitors([])
                }
            })()
        const onDisplaysChanged = async () => {
            try {
                const res = await window.ipcRenderer.invoke('system:getExternalMonitors')
                if (res?.ok && Array.isArray(res.data)) setExternalMonitors(res.data as string[])
            } catch { }
        }
        // If you later wire events from main to notify display changes, handle here.
        return () => { done = true }
    }, [])

    return (
        <div className='h-9 w-full drag flex items-center justify-between pl-2 border-b border-slate-700' >
            <div className="flex gap-2 w-full items-center">
                <div className="h-5 w-5 overflow-hidden rounded">
                    <img src="./dc.png" className="object-contain" />
                </div>
                <Menubar className='no-drag h-6 bg-transparent border-0 p-0 shadow-none text-white'>
                    <MenubarMenu>
                        <MenubarTrigger>File</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={() => setNewProjectOpen(true)} disabled={isRecordingStarted}>
                                New Project
                            </MenubarItem>
                            <MenubarItem onClick={() => setOpenProjectOpen(true)} disabled={isRecordingStarted}>
                                Open Project
                            </MenubarItem>
                            <MenubarSub>
                                <MenubarSubTrigger disabled={isRecordingStarted}>Open Recent Projects</MenubarSubTrigger>
                                <MenubarSubContent>
                                    {recentProjects.length === 0 ? (
                                        <MenubarItem data-disabled className="opacity-50">(none)</MenubarItem>
                                    ) : (
                                        recentProjects.map(p => (
                                            <MenubarItem key={p._id} disabled={isRecordingStarted} onClick={async () => {
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
                            <MenubarItem onClick={() => setEditProjectOpen(true)} disabled={!selectedProjectId || isRecordingStarted}>
                                Edit Project
                            </MenubarItem>
                            <MenubarItem
                                disabled={!selectedProjectId || isRecordingStarted}
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
                        <MenubarTrigger>Window</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={() => window.ipcRenderer.invoke('window:open-overlay-editor')}>Open Overlay Editor</MenubarItem>
                            <MenubarItem onClick={() => window.ipcRenderer.invoke('window:open-data-configurations')}>Open Data Configurations</MenubarItem>
                            <MenubarItem onClick={() => window.ipcRenderer.invoke('window:open-eventing')}>Open Eventing Window</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger>Preview</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={() => { try { window.ipcRenderer.invoke('window:open-pip') } catch { } }}>Open Picture in Picture Window</MenubarItem>
                            <MenubarSeparator/>
                            <MenubarSub>
                                <MenubarSubTrigger disabled={isRecordingStarted}>Monitors</MenubarSubTrigger>
                                <MenubarSubContent>
                                    {externalMonitors.length === 0 ? (
                                        <MenubarItem data-disabled className="opacity-50">(none)</MenubarItem>
                                    ) : (
                                        externalMonitors.map((name, idx) => (
                                            <MenubarSub key={`${name}-${idx}`}>
                                                <MenubarSubTrigger disabled={isRecordingStarted}>{name}</MenubarSubTrigger>
                                                <MenubarSubContent>
                                                    <MenubarItem disabled={isRecordingStarted} onClick={() => { try { window.ipcRenderer.invoke('window:open-channel-preview', name, 1) } catch {} }}>Channel 1</MenubarItem>
                                                    <MenubarItem disabled={isRecordingStarted} onClick={() => { try { window.ipcRenderer.invoke('window:open-channel-preview', name, 2) } catch {} }}>Channel 2</MenubarItem>
                                                    <MenubarItem disabled={isRecordingStarted} onClick={() => { try { window.ipcRenderer.invoke('window:open-channel-preview', name, 3) } catch {} }}>Channel 3</MenubarItem>
                                                    <MenubarItem disabled={isRecordingStarted} onClick={() => { try { window.ipcRenderer.invoke('window:open-channel-preview', name, 4) } catch {} }}>Channel 4</MenubarItem>
                                                </MenubarSubContent>
                                            </MenubarSub>
                                        ))
                                    )}
                                </MenubarSubContent>
                            </MenubarSub>
                        </MenubarContent>

                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger>Settings</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={() => setVideoConfigOpen(true)}>Video Configurations</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger>Export / Import</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem disabled={!selectedProjectId} onClick={() => window.ipcRenderer.invoke('window:open-export-project')}>Export Project Settings</MenubarItem>
                            <MenubarItem
                                disabled={!selectedProjectId}
                                onClick={async () => {
                                    try {
                                        const pick = await window.ipcRenderer.invoke('dialog:selectDirectory')
                                        if (!pick?.ok || !pick.data) return
                                        const exp = await window.ipcRenderer.invoke('project:export-project-file', pick.data)
                                        if (exp?.ok) {
                                            try { await window.ipcRenderer.invoke('system:notify', 'Export Complete', String(exp.data || 'Project file exported')) } catch { }
                                        } else {
                                            try { await window.ipcRenderer.invoke('system:notify', 'Export Failed', String(exp?.error || 'Unknown error')) } catch { }
                                        }
                                    } catch { }
                                }}
                            >
                                Export Project File
                            </MenubarItem>
                            <MenubarItem
                                onClick={async () => {
                                    try {
                                        const pick = await window.ipcRenderer.invoke('dialog:openJsonFile')
                                        if (!pick?.ok || !pick.data) return
                                        const res = await window.ipcRenderer.invoke('project:import-project-file-json', pick.data)
                                        if (res?.ok) {
                                            toast.success('Project imported successfully')
                                            try { const ev = new CustomEvent('projectsChanged'); window.dispatchEvent(ev) } catch {}
                                        } else {
                                            const msg = String(res?.error || '')
                                            if (msg.toLowerCase().includes('same name')) {
                                                toast.error('A project with the same name already exists')
                                            } else {
                                                toast.error(`Import failed: ${msg || 'Unknown error'}`)
                                            }
                                        }
                                    } catch (err: any) {
                                        const msg = String(err?.message || err || 'Unknown error')
                                        toast.error(`Import failed: ${msg}`)
                                    }
                                }}
                            >
                                Import Project File
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>
            </div>
            <div className="w-full flex items-center relative left-20">
                <span className="text-slate-400">{selectedProjectName || ''}</span>
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
                <VideoDeviceConfigurations />
            </DraggableDialog>
        </div >
    )
}