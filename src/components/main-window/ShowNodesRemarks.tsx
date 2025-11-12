import { useEffect, useState } from "react"
import { Input } from "../ui/input"

export default function ShowNodesRemarks() {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [remarks, setRemarks] = useState("")

    // Load current selected node id and keep in sync
    useEffect(() => {
        let done = false
            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('app:getSelectedNodeId')
                    if (!done && res?.ok) setSelectedNodeId(res.data ?? null)
                } catch { }
            })()
        const onNodeChanged = (e: any) => {
            try {
                const id = e?.detail ?? null
                setSelectedNodeId(id)
            } catch { }
        }
        window.addEventListener('selectedNodeChanged', onNodeChanged as any)
        return () => {
            done = true
            window.removeEventListener('selectedNodeChanged', onNodeChanged as any)
        }
    }, [])

    // Fetch remarks for the selected node; refetch when nodes change (edited/created)
    useEffect(() => {
        let cancelled = false
        async function load() {
            if (!selectedNodeId) {
                setRemarks("")
                return
            }
            try {
                const res = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', selectedNodeId)
                if (!cancelled) {
                    if (res?.ok && res.data) setRemarks(res.data.remarks || "")
                    else setRemarks("")
                }
            } catch {
                if (!cancelled) setRemarks("")
            }
        }
        load()
        const onNodesChanged = () => load()
        window.addEventListener('nodesChanged', onNodesChanged as any)
        return () => {
            cancelled = true
            window.removeEventListener('nodesChanged', onNodesChanged as any)
        }
    }, [selectedNodeId])

    return (
            <Input
                className="select-none pointer-events-none caret-transparent"
                value={selectedNodeId && remarks.trim().length > 0 ? remarks : ""}
                readOnly
                disabled={!selectedNodeId}
                placeholder={!selectedNodeId ? "No node selected" : (remarks.trim().length > 0 ? "" : "No remarks")}
            />
    )
}