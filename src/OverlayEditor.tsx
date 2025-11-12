import { BiDownload, BiPlus, BiUpload } from "react-icons/bi";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { DraggableDialog } from "@/components/ui/draggable-dialog";
import OverlayWindowBar from "./components/overlay-editor/OverlayWindowBar";
import CreateOverlayForm from "./components/overlay-editor/CreateOverlayForm";
import OverlayEditorCanvas, { STAGE_WIDTH, STAGE_HEIGHT } from "./components/ui/OverlayEditorCanvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { MdAlignHorizontalCenter, MdAlignHorizontalLeft, MdAlignHorizontalRight, MdAlignVerticalBottom, MdAlignVerticalCenter, MdAlignVerticalTop, MdDelete, MdEdit } from "react-icons/md";
import OverlayList from "./components/overlay-editor/OverlayList";
import RenameOverlayForm from "./components/overlay-editor/RenameOverlayForm";
import ComponentList from "./components/overlay-editor/ComponentList";
import CreateCustomTextButton from "./components/overlay-editor/CreateCustomTextButton";
import CreateImageButton from "./components/overlay-editor/CreateImageButton";
import EditComponentForm from "./components/overlay-editor/EditComponentForm";
import OverlayItem from "./components/ui/OverlayItem";
import { useTime } from "./hooks/useTime";
import { useDate } from "./hooks/useDate";
import CreateTimeButton from "./components/overlay-editor/CreateTimeButton";
import CreateDateButton from "./components/overlay-editor/CreateDateButton";
import CreateDataButton from "./components/overlay-editor/CreateDataButton";
import CreateDiveButton from "./components/overlay-editor/CreateDiveButton";
import CreateNodeButton from "./components/overlay-editor/CreateNodeButton";
import CreateTaskButton from "./components/overlay-editor/CreateTaskButton";
import DeleteOverlayConfirmation from "./components/overlay-editor/DeleteOverlayConfirmation";
import CreateProjectDetailsButton from "./components/overlay-editor/CreateProjectDetailsButton";
import { FaFileExport, FaFileImport } from "react-icons/fa";
import { toast } from "sonner";
import { Button } from "./components/ui/button";

export default function OverlayEditor() {
    const [newOverlayOpen, setNewOverlayOpen] = useState(false)
    const [renameOverlayOpen, setRenameOverlayOpen] = useState(false)
    const [editComponentOpen, setEditComponentOpen] = useState(false)
    const [deleteOverlayOpen, setDeleteOverlayOpen] = useState(false)
    const [components, setComponents] = useState<any[]>([])
    const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])
    const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)

    async function loadComponents() {
        try {
            const ovl = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
            const overlayId: string | null = ovl?.ok ? (ovl.data ?? null) : null
            setSelectedOverlayId(overlayId)
            if (!overlayId) {
                setComponents([])
                return
            }
            const res = await window.ipcRenderer.invoke('db:getOverlayComponentsForRender', { overlayId })
            if (res?.ok && Array.isArray(res.data)) {
                setComponents(res.data)
            } else {
                setComponents([])
            }
        } catch {
            setComponents([])
        }
    }

    useEffect(() => {
        loadComponents()
        const onOverlayChanged = async () => {
            // Clear selected component when overlay changes
            try { await window.ipcRenderer.invoke('app:setSelectedOverlayComponentIds', []) } catch { }
            setSelectedComponentIds([])
            loadComponents()
        }
        const onComponentsChanged = () => loadComponents()
        const onSelectedComponentIdsChanged = (e: any) => {
            try {
                const ids = Array.isArray(e?.detail) ? e.detail : []
                setSelectedComponentIds(ids)
            } catch { }
        }
        const onOverlayRefresh = async () => {
            try {
                // Broadcast refresh message (without overlayId) to channels 1..4.
                // overlay.html will only refresh if it already has a current overlay selected.
                for (let ch = 1; ch <= 4; ch++) {
                    try {
                        const ws = new WebSocket(`ws://127.0.0.1:3620/overlay?ch=${ch}`)
                        const sendRefresh = () => {
                            try { ws.send(JSON.stringify({ action: 'refresh' })) } catch { }
                            try { ws.close() } catch { }
                        }
                        if (ws.readyState === WebSocket.OPEN) {
                            sendRefresh()
                        } else {
                            ws.addEventListener('open', sendRefresh, { once: true })
                        }
                    } catch { }
                }
            } catch { }
        }
        window.addEventListener('selectedOverlayLayerChanged', onOverlayChanged as any)
        window.addEventListener('overlayComponentsChanged', onComponentsChanged as any)
        window.addEventListener('selectedOverlayComponentIdsChanged', onSelectedComponentIdsChanged as any)
        window.addEventListener('overlay:refresh', onOverlayRefresh as any)
            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('app:getSelectedOverlayComponentIds')
                    if (res?.ok) setSelectedComponentIds(Array.isArray(res.data) ? res.data : [])
                } catch { }
            })()
        return () => {
            window.removeEventListener('selectedOverlayLayerChanged', onOverlayChanged as any)
            window.removeEventListener('overlayComponentsChanged', onComponentsChanged as any)
            window.removeEventListener('selectedOverlayComponentIdsChanged', onSelectedComponentIdsChanged as any)
            window.removeEventListener('overlay:refresh', onOverlayRefresh as any)
        }
    }, [])

    async function applyAlignment(action: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
        try {
            const ids = selectedComponentIds
            if (!ids.length) return
            const byId = new Map(components.map((c) => [c._id, c]))
            const updates: { id: string; x?: number; y?: number; width: number; height: number }[] = []
            for (const id of ids) {
                const c = byId.get(id)
                if (!c) continue
                let nextX: number | undefined = undefined
                let nextY: number | undefined = undefined
                if (action === 'left') nextX = 0
                if (action === 'hcenter') nextX = (STAGE_WIDTH - c.width) / 2
                if (action === 'right') nextX = STAGE_WIDTH - c.width
                if (action === 'top') nextY = 0
                if (action === 'vcenter') nextY = (STAGE_HEIGHT - c.height) / 2
                if (action === 'bottom') nextY = STAGE_HEIGHT - c.height
                updates.push({ id, x: nextX, y: nextY, width: c.width, height: c.height })
            }
            if (!updates.length) return

            // Persist each update (x and/or y)
            await Promise.all(updates.map((u) => window.ipcRenderer.invoke('db:editOverlayComponent', {
                ids: [u.id],
                updates: {
                    ...(typeof u.x === 'number' ? { x: u.x } : {}),
                    ...(typeof u.y === 'number' ? { y: u.y } : {}),
                }
            })))

            // Update local state
            setComponents((prev) => prev.map((c) => {
                const u = updates.find((it) => it.id === c._id)
                if (!u) return c
                return { ...c, x: typeof u.x === 'number' ? u.x : c.x, y: typeof u.y === 'number' ? u.y : c.y }
            }))

            try {
                const ev = new CustomEvent('overlayComponentsChanged', { detail: { action: 'moved' } })
                window.dispatchEvent(ev)
                const refresh = new CustomEvent('overlay:refresh')
                window.dispatchEvent(refresh)
            } catch { }
        } catch { }
    }
    return (
        <div className='h-screen flex flex-col bg-[#1D2229]'>
            <OverlayWindowBar />
            <div className="flex-1 flex p-2 gap-1">
                <div className="flex-none flex flex-col gap-1 h-full w-[310px]">
                    <Tabs defaultValue="overlay" className="h-full">
                        <TabsList>
                            <TabsTrigger value="overlay">Overlay</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overlay" className="flex flex-col gap-1">
                            <div className="flex gap-1">
                                <Button
                                    title="Export Overlay"
                                    disabled={!selectedOverlayId}
                                    onClick={async () => {
                                        try {
                                            if (!selectedOverlayId) return
                                            const dir = await window.ipcRenderer.invoke('dialog:selectDirectory')
                                            if (!dir?.ok || !dir.data) return
                                            let overlayName = 'overlay'
                                            try {
                                                const all = await window.ipcRenderer.invoke('db:getAllOverlay')
                                                const match = all?.ok && Array.isArray(all.data) ? all.data.find((o: any) => String(o._id) === String(selectedOverlayId)) : null
                                                overlayName = match?.name ? String(match.name) : 'overlay'
                                            } catch {}
                                            const safe = overlayName.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'overlay'
                                            const destination = `${dir.data}\\${safe}.json`
                                            const res = await window.ipcRenderer.invoke('db:exportOverlay', { destPath: destination, overlayId: selectedOverlayId })
                                            if (!res?.ok) {
                                                console.warn('Export failed:', res?.error)
                                            }
                                        } catch {}
                                    }}
                                >
                                    <FaFileExport className="h-4 w-4" />
                                    <span>Export Overlay</span>
                                </Button>
                                <Button
                                    title="Import Overlay"
                                    onClick={async () => {
                                        try {
                                            // Ask main process to select a JSON file
                                            const file = await window.ipcRenderer.invoke('dialog:openJsonFile')
                                            if (!file?.ok) return
                                            const filePath = String(file.data || '')
                                            if (!filePath.toLowerCase().endsWith('.json')) {
                                                toast.error('Please select a .json overlay file')
                                                return
                                            }
                                            const res = await window.ipcRenderer.invoke('db:importOverlay', { sourcePath: filePath })
                                            if (!res?.ok) {
                                                toast.error(res?.error || 'Failed to import overlay')
                                                return
                                            }
                                            toast.success('Overlay imported')
                                            try { const ev = new CustomEvent('overlaysChanged', { detail: { id: res.data?.overlayId, action: 'created' } }); window.dispatchEvent(ev) } catch {}
                                        } catch (err) {
                                            toast.error('Failed to import overlay')
                                        }
                                    }}
                                >
                                    <FaFileImport className="h-4 w-4" />
                                    <span>Import Overlay</span>
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                <Button 
                                    onClick={() => setNewOverlayOpen(true)} 
                                    title="New Overlay"
                                >
                                    <BiPlus className="h-6 w-6" />
                                    <span>New Overlay</span>
                                </Button>
                                <Button 
                                    onClick={() => setRenameOverlayOpen(true)} 
                                    title="Rename Overlay" 
                                >
                                    <MdEdit className="h-4.5 w-4.5" />
                                    <span>Rename Overlay</span>
                                </Button>
                                <Button
                                    title="Delete Overlay"
                                    onClick={() => setDeleteOverlayOpen(true)}
                                >
                                    <MdDelete className="h-4.5 w-4.5" />
                                    <span>Delete Overlay</span>
                                </Button>
                            </div>
                            <OverlayList />
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                    <Tabs defaultValue="editor" className="h-full">
                        <TabsList>
                            <TabsTrigger value="editor">Editor</TabsTrigger>
                        </TabsList>
                        <TabsContent value="editor" className="flex flex-col gap-1 p-0">
                            <div className="flex-none w-full h-[37px] bg-[#363D4A] flex items-center px-1 gap-1.5">
                                <CreateCustomTextButton />
                                <CreateImageButton />
                                <CreateTimeButton />
                                <CreateDateButton />
                                <CreateDataButton />
                                <CreateDiveButton />
                                <CreateNodeButton />
                                <CreateTaskButton />
                                <CreateProjectDetailsButton />
                            </div>
                            <div className="flex-1 bg-black">
                                <OverlayEditorCanvas
                                    onItemsMoved={async (positions) => {
                                        try {
                                            await Promise.all(positions.map((p) =>
                                                window.ipcRenderer.invoke('db:editOverlayComponent', {
                                                    ids: [p.id],
                                                    updates: { x: p.x, y: p.y, width: p.width, height: p.height }
                                                })
                                            ))
                                            try {
                                                const ev = new CustomEvent('overlayComponentsChanged', { detail: { action: 'moved' } })
                                                window.dispatchEvent(ev)
                                                const refresh = new CustomEvent('overlay:refresh')
                                                window.dispatchEvent(refresh)
                                            } catch { }
                                        } catch { }
                                    }}
                                    selectedItemIdsFromOutside={selectedComponentIds}
                                    onSelectionChange={async (ids) => {
                                        setSelectedComponentIds(ids)
                                        try {
                                            await window.ipcRenderer.invoke('app:setSelectedOverlayComponentIds', ids)
                                            try {
                                                const last = ids.length ? ids[ids.length - 1] : null
                                                const ev = new CustomEvent('selectedOverlayComponentChanged', { detail: last })
                                                window.dispatchEvent(ev)
                                                const ev2 = new CustomEvent('selectedOverlayComponentIdsChanged', { detail: ids })
                                                window.dispatchEvent(ev2)
                                            } catch { }
                                        } catch { }
                                    }}
                                >
                                    {components.map((c) => (
                                        <OverlayItem
                                            key={c._id}
                                            id={c._id}
                                            type={c.type}
                                            x={c.x}
                                            y={c.y}
                                            width={c.width}
                                            height={c.height}
                                            onChange={(next) => {
                                                setComponents((prev) => prev.map((it) => it._id === c._id ? { ...it, ...next } : it))
                                            }}
                                            onItemDoubleClick={() => setEditComponentOpen(true)}
                                        >
                                            <div
                                                className="w-full h-full"
                                                style={{
                                                    backgroundColor: c.backgroundColor || 'transparent',
                                                    border: c.borderColor ? `1px solid ${c.borderColor}` : undefined,
                                                    borderRadius: typeof c.radius === 'number' ? c.radius : undefined,
                                                    display: 'flex',
                                                    alignItems: c.textStyle?.verticalAlign === 'bottom' || c.textStyle?.verticalAlign === 'end' ? 'flex-end' : c.textStyle?.verticalAlign === 'top' || c.textStyle?.verticalAlign === 'start' ? 'flex-start' : 'center',
                                                    justifyContent: c.textStyle?.align === 'right' || c.textStyle?.align === 'end' ? 'flex-end' : c.textStyle?.align === 'center' ? 'center' : 'flex-start',
                                                    padding: '4px',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {c.type === 'image' ? (
                                                    c.imagePath ? (
                                                        <img src={c.imagePath} className="max-w-full max-h-full object-contain" style={{ opacity: typeof (c as any).opacity === 'number' ? (c as any).opacity : 1 }} draggable={false} />
                                                    ) : (
                                                        <div className="text-white/60 text-xs">No image</div>
                                                    )
                                                ) : c.type === 'custom-text' || c.type === 'time' || c.type === 'date' || c.type === 'data' || c.type === 'dive' || c.type === 'node' || c.type === 'task' || c.type === 'project' ? (
                                                    <TextOverlayContent component={c} />
                                                ) : (
                                                    <div className="text-white/80 text-xs">{c.name}</div>
                                                )}
                                            </div>
                                        </OverlayItem>
                                    ))}
                                </OverlayEditorCanvas>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="flex-none h-full w-[300px]">
                    <Tabs defaultValue="properties" className="h-full">
                        <TabsList>
                            <TabsTrigger value="properties">Properties</TabsTrigger>
                        </TabsList>
                        <TabsContent value="properties" className="flex flex-col gap-1">
                            <div className="flex gap-1">
                                <Button
                                    disabled={!selectedOverlayId || selectedComponentIds.length === 0}
                                    onClick={() => setEditComponentOpen(true)}
                                    title="Edit Component">
                                    <MdEdit className="h-4.5 w-4.5" />
                                    <span>Edit Item</span>
                                </Button>
                                <Button
                                    title="Delete Component(s)"
                                    disabled={!selectedOverlayId || selectedComponentIds.length === 0}
                                    onClick={async () => {
                                        try {
                                            const ids = selectedComponentIds
                                            if (!Array.isArray(ids) || ids.length === 0) return
                                            const del = await window.ipcRenderer.invoke('db:deleteOverlayComponent', { ids })
                                            if (del?.ok) {
                                                try { await window.ipcRenderer.invoke('app:setSelectedOverlayComponentIds', []) } catch { }
                                                setSelectedComponentIds([])
                                                try {
                                                    const ev = new CustomEvent('overlayComponentsChanged', { detail: { ids, action: 'deleted' } })
                                                    window.dispatchEvent(ev)
                                                    const refresh = new CustomEvent('overlay:refresh')
                                                    window.dispatchEvent(refresh)
                                                } catch { }
                                            }
                                        } catch { }
                                    }}
                                >
                                    <MdDelete className="h-4.5 w-4.5" />
                                    <span>Delete Item</span>
                                </Button>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => applyAlignment('left')}
                                    title="Align Left"
                                    className="bg-black/20 rounded-[7px] flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none" disabled={!selectedOverlayId || selectedComponentIds.length === 0}>
                                    <MdAlignHorizontalLeft className="h-4.5 w-4.5" />
                                    <span className="font-medium text-[10px]">Align Left</span>
                                </button>
                                <button
                                    onClick={() => applyAlignment('hcenter')}
                                    title="Align Horizontal Center"
                                    className="bg-black/20 rounded-[7px] flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none" disabled={!selectedOverlayId || selectedComponentIds.length === 0}>
                                    <MdAlignHorizontalCenter className="h-4.5 w-4.5" />
                                    <span className="font-medium text-[10px]">Align H Cntr</span>
                                </button>
                                <button
                                    onClick={() => applyAlignment('right')}
                                    title="Align Right"
                                    className="bg-black/20 rounded-[7px] flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none" disabled={!selectedOverlayId || selectedComponentIds.length === 0}>
                                    <MdAlignHorizontalRight className="h-4.5 w-4.5" />
                                    <span className="font-medium text-[10px]">Align Right</span>
                                </button>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => applyAlignment('top')}
                                    title="Align Top"
                                    className="bg-black/20 rounded-[7px] flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none" disabled={!selectedOverlayId || selectedComponentIds.length === 0}>
                                    <MdAlignVerticalTop className="h-4.5 w-4.5" />
                                    <span className="font-medium text-[10px]">Align Top</span>
                                </button>
                                <button
                                    onClick={() => applyAlignment('vcenter')}
                                    title="Align Vertical Center"
                                    className="bg-black/20 rounded-[7px] flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none" disabled={!selectedOverlayId || selectedComponentIds.length === 0}>
                                    <MdAlignVerticalCenter className="h-4.5 w-4.5" />
                                    <span className="font-medium text-[10px]">Align V Cntr</span>
                                </button>
                                <button
                                    onClick={() => applyAlignment('bottom')}
                                    title="Align Bottom"
                                    className="bg-black/20 rounded-[7px] flex items-center justify-center h-[28px] px-2 gap-1 hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none" disabled={!selectedOverlayId || selectedComponentIds.length === 0}>
                                    <MdAlignVerticalBottom className="h-4.5 w-4.5" />
                                    <span className="font-medium text-[10px]">Align Bottom</span>
                                </button>
                            </div>
                            <ComponentList />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            <DraggableDialog
                open={newOverlayOpen}
                onOpenChange={setNewOverlayOpen}
                title="New Overlay"
            >
                <CreateOverlayForm onClose={() => setNewOverlayOpen(false)} />
            </DraggableDialog>
            <DraggableDialog
                open={renameOverlayOpen}
                onOpenChange={setRenameOverlayOpen}
                title="Rename Overlay"
            >
                <RenameOverlayForm onClose={() => setRenameOverlayOpen(false)} />
            </DraggableDialog>
            <DraggableDialog
                open={editComponentOpen}
                onOpenChange={setEditComponentOpen}
                title="Edit Component"
                useBackdrop={false}
            >
                <EditComponentForm onClose={() => setEditComponentOpen(false)} />
            </DraggableDialog>
            <DraggableDialog
                open={deleteOverlayOpen}
                onOpenChange={setDeleteOverlayOpen}
                title="Delete Overlay"
            >
                <DeleteOverlayConfirmation onClose={() => setDeleteOverlayOpen(false)} />
            </DraggableDialog>
        </div>
    )
}

function buildTextSpanStyle(component: any): CSSProperties {
    return {
        fontFamily: component.textStyle?.fontFamily,
        fontSize: component.textStyle?.fontSize,
        fontWeight: component.textStyle?.fontWeight as any,
        fontStyle: component.textStyle?.italic ? 'italic' : undefined,
        textDecoration: component.textStyle?.underline ? 'underline' : undefined,
        color: component.textStyle?.color || '#fff',
        textTransform: component.textStyle?.uppercase ? 'uppercase' : undefined,
        letterSpacing: component.textStyle?.letterSpacing,
        lineHeight: component.textStyle?.lineHeight as any,
    }
}

function formatTimeDisplay(raw: string, format: string | undefined, twentyFourHour: boolean): string {
    let result = raw.trim()
    if (!/s/i.test(format ?? 'ss')) {
        result = result.replace(/:(\d{2})(?:(?=\s)|$)/, '')
    }
    if (twentyFourHour) {
        result = result.replace(/\s*[AP]M$/i, '').trim()
    }
    return result
}

function TextOverlayContent({ component }: { component: any }) {
    const style = buildTextSpanStyle(component)
    // Helper: live serial data polling for data components
    const [serialOpen, setSerialOpen] = useState(false)
    const [serialValue, setSerialValue] = useState<string>("")
	// Helper: selected node preview for node components
	const [selectedNodePreview, setSelectedNodePreview] = useState<{ name: string; level?: number } | null>(null)
    useEffect(() => {
        if (component.type !== 'data') return
        let cancelled = false
        const id = setInterval(async () => {
            try {
                const res = await window.ipcRenderer.invoke('serial:getDeviceState')
                if (!cancelled && res?.ok && res.data) {
                    const s = res.data as any
                    setSerialOpen(!!s.isOpen)
                    if (s.isOpen && Array.isArray(s.currentFields) && component.dataKey) {
                        const match = s.currentFields.find((f: any) => (f?.key ?? null) === component.dataKey)
                        setSerialValue(match ? String(match.value ?? '') : '')
                    } else {
                        setSerialValue("")
                    }
                }
            } catch { }
        }, 500)
        return () => { cancelled = true; clearInterval(id) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [component?.type, component?.dataKey])

	// Keep node preview in sync with global selected node
	useEffect(() => {
		// Only relevant for node components
		let cancelled = false
		if (component.type !== 'node') { setSelectedNodePreview(null); return }

		const resolvePreviewFrom = async (nodeId: string | null) => {
			if (!nodeId) { if (!cancelled) setSelectedNodePreview(null); return }
			try {
				// Build full path from root -> selected by following parentId chain
				const path: { name?: string; level?: number; parentId?: string }[] = []
				let guard = 0
				let curId: string | undefined | null = nodeId
				while (curId && guard++ < 100) {
					const res = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', curId)
					if (!res?.ok || !res.data) break
					path.push({ name: res.data.name, level: res.data.level, parentId: res.data.parentId })
					curId = res.data.parentId
				}
				if (!path.length) { if (!cancelled) setSelectedNodePreview(null); return }
				path.reverse() // now index 0 = topmost under project
				const desiredLevel = typeof component.nodeLevel === 'number' ? component.nodeLevel : undefined
				let chosenName: string | undefined
				let chosenLevel: number | undefined
				if (typeof desiredLevel === 'number' && desiredLevel >= 1) {
					const index = desiredLevel - 1
					if (index <= path.length - 1) {
						const node = path[index]
						chosenName = node?.name
						chosenLevel = node?.level
					} else {
						// Missing deeper levels → fall back to overlay component name by clearing preview
						if (!cancelled) { setSelectedNodePreview(null) }
						return
					}
				} else {
					const node = path[path.length - 1]
					chosenName = node?.name
					chosenLevel = node?.level
				}
				if (!cancelled) setSelectedNodePreview(chosenName ? { name: chosenName, level: chosenLevel } : null)
			} catch {
				if (!cancelled) setSelectedNodePreview(null)
			}
		}

		;(async () => {
			try {
				const sel = await window.ipcRenderer.invoke('app:getSelectedNodeId')
				await resolvePreviewFrom(sel?.ok ? (sel.data ?? null) : null)
			} catch { if (!cancelled) setSelectedNodePreview(null) }
		})()

		const onSel = (e: any, arg?: any) => {
			try {
				const id = (typeof arg === 'string') ? arg : (typeof e?.detail === 'string' ? e.detail : null)
				resolvePreviewFrom(id)
			} catch { setSelectedNodePreview(null) }
		}
		window.addEventListener('selectedNodeChanged', onSel as any)
		try { window.ipcRenderer.on('app:selectedNodeChanged', onSel as any) } catch {}
		return () => {
			cancelled = true
			window.removeEventListener('selectedNodeChanged', onSel as any)
			try { window.ipcRenderer.off('app:selectedNodeChanged', onSel as any) } catch {}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [component?.type, component?.nodeLevel])
    if (component.type === 'time') {
        const value = useTime({ twentyFourHour: component.twentyFourHour ?? true, useUTC: component.useUTC ?? false })
        return (
            <span style={style}>
                {formatTimeDisplay(value, component.timeFormat, component.twentyFourHour ?? true)}
            </span>
        )
    }
    if (component.type === 'date') {
        const value = useDate({ useUTC: component.useUTC ?? false })
        return <span style={style}>{value}</span>
    }
    if (component.type === 'data') {
        const placeholder = component.dataKey || component.customText || component.name
        const content = serialOpen && serialValue ? serialValue : placeholder
        return <span style={style}>{content}</span>
    }
    if (component.type === 'dive') {
        return <span style={style}>{component.customText || component.name}</span>
    }
    if (component.type === 'node') {
		const fallbackName = component.customText || component.name
		const text = selectedNodePreview?.name || fallbackName
		return (
			<span style={style} className="inline-flex items-center gap-1">
				{text}
			</span>
		)
    }
    if (component.type === 'task') {
        return <span style={style}>{component.customText || component.name}</span>
    }
    if (component.type === 'project') {
        return <ProjectOverlayContent detail={component.projectDetail} style={style} />
    }
    return <span style={style}>{component.customText || component.name}</span>
}

function ProjectOverlayContent({ detail, style }: { detail?: string; style: CSSProperties }) {
    const [text, setText] = useState('')

    useEffect(() => {
        let cancelled = false
        async function load() {
            try {
                const sel = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                const projectId: string | null = sel?.ok ? (sel.data ?? null) : null
                if (!projectId) { if (!cancelled) setText('undefined'); return }
                const res = await window.ipcRenderer.invoke('db:getSelectedProjectDetails', projectId)
                const p = res?.ok ? (res.data ?? null) : null
                if (!cancelled) {
                    const key = (detail as any) || 'name'
                    let value: string
                    if (!p || typeof p !== 'object') {
                        value = 'undefined'
                    } else {
                        const raw = (p as any)[key]
                        if (raw === null || typeof raw === 'undefined') {
                            value = 'undefined'
                        } else if (typeof raw === 'string') {
                            value = raw.trim() === '' ? 'undefined' : raw
                        } else {
                            const coerced = String(raw)
                            value = coerced.trim() === '' ? 'undefined' : coerced
                        }
                    }
                    setText(value)
                }
            } catch {
                if (!cancelled) setText('undefined')
            }
        }
        load()
        const onSel = () => { void load() }
        window.addEventListener('selectedProjectChanged', onSel as any)
        return () => {
            cancelled = true
            window.removeEventListener('selectedProjectChanged', onSel as any)
        }
    }, [detail])

    return <span style={style}>{text}</span>
}

