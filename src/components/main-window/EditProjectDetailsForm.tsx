import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    onClose: () => void
}

export default function EditProjectDetailsForm({ onClose }: Props) {
    const [projectId, setProjectId] = useState<string | null>(null)
    const [name, setName] = useState("")
    const [client, setClient] = useState("")
    const [contractor, setContractor] = useState("")
    const [vessel, setVessel] = useState("")
    const [location, setLocation] = useState("")
    const [projectType, setProjectType] = useState<"platform" | "pipeline">("platform")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const sel = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                const id: string | null = sel?.ok ? sel.data ?? null : null
                if (!id) return
                if (cancelled) return
                setProjectId(id)
                const res = await window.ipcRenderer.invoke('db:getSelectedProjectDetails', id)
                if (cancelled) return
                if (res?.ok && res.data) {
                    const p = res.data
                    setName(p.name || "")
                    setClient(p.client || "")
                    setContractor(p.contractor || "")
                    setVessel(p.vessel || "")
                    setLocation(p.location || "")
                    setProjectType(p.projectType || 'platform')
                } else if (!res?.ok) {
                    setError(res?.error || 'Failed to load project')
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error')
            }
        })()
        return () => { cancelled = true }
    }, [])

    async function onApply() {
        if (!projectId) return
        setError(null)
        try {
            setSubmitting(true)
            const updates = { name, client, contractor, vessel, location }
            const res = await window.ipcRenderer.invoke('db:editProject', projectId, updates)
            if (!res?.ok) {
                setError(res?.error || 'Failed to update project')
                return
            }
            try { window.dispatchEvent(new Event('projectsChanged')) } catch {}
            try { window.dispatchEvent(new CustomEvent('selectedProjectChanged', { detail: projectId })) } catch {}
            onClose()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span>Project Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span>Project Type</span>
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
                <span>Client</span>
                <Input value={client} onChange={(e) => setClient(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span>Contractor</span>
                <Input value={contractor} onChange={(e) => setContractor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span>Vessel</span>
                <Input value={vessel} onChange={(e) => setVessel(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <span>Location</span>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button onClick={onApply} disabled={submitting || !projectId}>
                    Apply
                </Button>
            </div>
        </div>
    )
}