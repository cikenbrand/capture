import { BiPlus } from "react-icons/bi";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { DraggableDialog } from "@/components/ui/draggable-dialog";
import OverlayWindowBar from "./components/overlay-editor/OverlayWindowBar";
import CreateOverlayForm from "./components/overlay-editor/CreateOverlayForm";
import OverlayEditorCanvas from "./components/ui/OverlayEditorCanvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { MdDelete, MdEdit } from "react-icons/md";
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
                            try { ws.send(JSON.stringify({ action: 'refresh' })) } catch {}
                            try { ws.close() } catch {}
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
    return (
        <div className='h-screen flex flex-col bg-[#1D2229]'>
            <OverlayWindowBar />
            <div className="flex-1 flex p-2 gap-1">
                <div className="flex-none flex flex-col gap-1 h-full w-[300px]">
                    <Tabs defaultValue="overlay" className="h-full">
                        <TabsList>
                            <TabsTrigger value="overlay">Overlay</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overlay" className="flex flex-col gap-1">
                            <div className="flex gap-1">
                                <button onClick={() => setNewOverlayOpen(true)} title="New Overlay" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <BiPlus className="h-6 w-6" />
                                </button>
                                <button onClick={() => setRenameOverlayOpen(true)} title="Rename Overlay" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <MdEdit className="h-4.5 w-4.5" />
                                </button>
                                <button
                                    title="Delete Overlay"
                                    className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none"
                                    onClick={() => setDeleteOverlayOpen(true)}
                                >
                                    <MdDelete className="h-4.5 w-4.5" />
                                </button>
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
                                <CreateProjectDetailsButton/>
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
                                                        <img src={c.imagePath} className="max-w-full max-h-full object-contain" draggable={false}/>
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
                                <button onClick={() => setEditComponentOpen(true)} title="Edit Component" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none" disabled={!selectedOverlayId || selectedComponentIds.length === 0}>
                                    <MdEdit className="h-4.5 w-4.5" />
                                </button>
                                <button
                                    title="Delete Component(s)"
                                    className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none"
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
                <DeleteOverlayConfirmation onClose={() => setDeleteOverlayOpen(false)}/>
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
        return <span style={style}>{component.customText || component.name}</span>
    }
    if (component.type === 'dive') {
        return <span style={style}>{component.customText || component.name}</span>
    }
    if (component.type === 'node') {
        const level = typeof component.nodeLevel === 'number' ? component.nodeLevel : undefined
        return (
            <span style={style} className="inline-flex items-center gap-1">
                {component.customText || component.name}
                {level ? ` (L${level})` : ''}
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

