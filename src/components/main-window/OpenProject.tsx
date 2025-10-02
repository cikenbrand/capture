import { useEffect, useState } from "react";
import { Button } from "../ui/button";

type Props = {
    onClose: () => void
}

type Project = {
    _id: string
    name: string
    client: string
    contractor: string
    vessel: string
    location: string
    projectType: "platform" | "pipeline"
    lastSelectedDiveId?: string | null
    lastSelectedTaskId?: string | null
    lastSelectedNodeId?: string | null
    createdAt: string | Date
    updatedAt: string | Date
}

export default function OpenProject({ onClose }: Props) {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selectedProject = projects.find(p => p._id === selectedId) || null

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            setError(null)
            try {
                const res = await window.ipcRenderer.invoke('db:getAllProjects')
                if (!cancelled) {
                    if (res?.ok) {
                        setProjects(res.data as Project[])
                    } else {
                        setError(res?.error || 'Failed to load projects')
                    }
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    async function onOpenSelected() {
        if (!selectedId) return
        await window.ipcRenderer.invoke('app:setSelectedProjectId', selectedId)
        try {
            const ev = new CustomEvent('selectedProjectChanged', { detail: selectedId })
            window.dispatchEvent(ev)
        } catch {}
        // Auto-select last selected dive for this project, if any
        try {
            const targetDiveId = selectedProject?.lastSelectedDiveId ?? null
            await window.ipcRenderer.invoke('app:setSelectedDiveId', targetDiveId)
            try {
                const ev2 = new CustomEvent('selectedDiveChanged', { detail: targetDiveId })
                window.dispatchEvent(ev2)
            } catch {}
        } catch {}
        // Auto-select last selected task for this project, if any
        try {
            const targetTaskId = selectedProject?.lastSelectedTaskId ?? null
            await window.ipcRenderer.invoke('app:setSelectedTaskId', targetTaskId)
            try {
                const ev3 = new CustomEvent('selectedTaskChanged', { detail: targetTaskId })
                window.dispatchEvent(ev3)
            } catch {}
        } catch {}
        // Auto-select last selected node for this project, if any
        try {
            const targetNodeId = selectedProject?.lastSelectedNodeId ?? null
            await window.ipcRenderer.invoke('app:setSelectedNodeId', targetNodeId)
            try {
                const ev4 = new CustomEvent('selectedNodeChanged', { detail: targetNodeId })
                window.dispatchEvent(ev4)
            } catch {}
        } catch {}
        onClose()
    }

    return (
        <div className="flex flex-col gap-3 h-[600px]">
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="flex gap-2 flex-1 min-h-0">
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <span className="font-bold relative left-2">Project Files</span>
                    <div className="p-1 rounded bg-[#252B34] flex-1 min-h-0">
                        <div className="h-full overflow-auto">
                            {loading ? (
                                <div className="text-white/60 text-sm">Loading projects…</div>
                            ) : (
                                <div className="flex flex-col">
                                    {projects.map(p => {
                                        const isSelected = selectedId === p._id
                                        return (
                                            <div
                                                key={p._id}
                                                className={
                                                    (isSelected
                                                        ? "bg-[#3A526A] hover:bg-[#3A526A] text-white px-3 py-1.5 cursor-pointer outline-none rounded"
                                                        : "bg-[#252B34] hover:bg-[#2B3744] text-white/80 px-3 py-1.5 cursor-pointer outline-none rounded")
                                                }
                                                onClick={() => setSelectedId(p._id)}
                                            >
                                                <div className="truncate" title={p.name}>{p.name}</div>
                                            </div>
                                        )
                                    })}
                                    {projects.length === 0 && !loading ? (
                                        <div className="text-white/60 text-sm">No projects found.</div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <span className="font-bold relative left-2">Details</span>
                    <div className="p-1 rounded bg-[#252B34] flex-1 min-h-0">
                        <div className="h-full overflow-auto">
                            {!selectedProject ? (
                                <div className="text-white/60 text-sm px-3 py-2">Select a project to view details.</div>
                            ) : (
                                <div className="text-sm text-white/80 px-3 py-2 space-y-2">
                                    <div className="text-white text-base font-medium">{selectedProject.name}</div>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                                        <div className="text-white/50">Type</div>
                                        <div className="text-white/90">{selectedProject.projectType}</div>
                                        <div className="text-white/50">Vessel</div>
                                        <div className="text-white/90">{selectedProject.vessel || '-'}</div>
                                        <div className="text-white/50">Location</div>
                                        <div className="text-white/90">{selectedProject.location || '-'}</div>
                                        <div className="text-white/50">Client</div>
                                        <div className="text-white/90">{selectedProject.client || '-'}</div>
                                        <div className="text-white/50">Contractor</div>
                                        <div className="text-white/90">{selectedProject.contractor || '-'}</div>
                                        <div className="text-white/50">Created</div>
                                        <div className="text-white/90">{new Date(selectedProject.createdAt).toLocaleString()}</div>
                                        <div className="text-white/50">Last updated</div>
                                        <div className="text-white/90">{new Date(selectedProject.updatedAt).toLocaleString()}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose}>
                    Cancel
                </Button>
                <Button onClick={onOpenSelected} disabled={!selectedId}>
                    Open
                </Button>
            </div>
        </div>
    )
}