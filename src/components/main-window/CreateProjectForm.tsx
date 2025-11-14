import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    onClose: () => void
}

export default function CreateProjectForm({ onClose }: Props) {
    const [name, setName] = useState("")
    const [client, setClient] = useState("")
    const [contractor, setContractor] = useState("")
    const [vessel, setVessel] = useState("")
    const [location, setLocation] = useState("")
    const [projectType, setProjectType] = useState<"platform" | "pipeline">("platform")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onCreate() {
        setError(null)
        if (!name.trim()) {
            setError("Project name is required")
            return
        }
        try {
            setSubmitting(true)
            const result = await window.ipcRenderer.invoke('db:createProject', {
                name,
                client,
                contractor,
                vessel,
                location,
                projectType,
            })
            if (result?.ok) {
                const newId: string | undefined = result.data
                if (newId) {
                    await window.ipcRenderer.invoke('app:setSelectedProjectId', newId)
                    try { window.dispatchEvent(new CustomEvent('selectedProjectChanged', { detail: newId })) } catch {}
                    try { window.dispatchEvent(new CustomEvent('projectsChanged')) } catch {}
                }
                onClose()
            } else {
                setError(result?.error || 'Failed to create project')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span className="text-slate-400">Project Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-slate-400">Project Type</span>
                <Select value={projectType} onValueChange={(v) => setProjectType(v as any)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="platform">Platform</SelectItem>
                        <SelectItem value="pipeline">Pipeline</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-slate-400">Client</span>
                <Input value={client} onChange={(e) => setClient(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-slate-400">Contractor</span>
                <Input value={contractor} onChange={(e) => setContractor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-slate-400">Vessel</span>
                <Input value={vessel} onChange={(e) => setVessel(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-slate-400">Location</span>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button onClick={onCreate} disabled={submitting || !name.trim()}>
                    Create
                </Button>
            </div>
        </div>
    )
}