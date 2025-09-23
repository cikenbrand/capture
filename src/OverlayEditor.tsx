import { BiPlus } from "react-icons/bi";
import { useEffect, useState } from "react";
import { DraggableDialog } from "@/components/ui/draggable-dialog";
import OverlayWindowBar from "./components/overlay-editor/OverlayWindowBar";
import CreateOverlayForm from "./components/overlay-editor/CreateOverlayForm";
import OverlayEditorCanvas from "./components/ui/OverlayEditorCanvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { MdDelete, MdEdit } from "react-icons/md";
import OverlayList from "./components/overlay-editor/OverlayList";
import RenameOverlayForm from "./components/overlay-editor/RenameOverlayForm";
import { IoIosTime } from "react-icons/io";
import { IoCalendar } from "react-icons/io5";
import { LuCable } from "react-icons/lu";
import { FaPersonSwimming } from "react-icons/fa6";
import { FaFolderTree } from "react-icons/fa6";
import ComponentList from "./components/overlay-editor/ComponentList";
import CreateCustomTextButton from "./components/overlay-editor/CreateCustomTextButton";
import CreateImageButton from "./components/overlay-editor/CreateImageButton";
import EditComponentForm from "./components/overlay-editor/EditComponentForm";
import OverlayItem from "./components/ui/OverlayItem";

export default function OverlayEditor() {
    const [newOverlayOpen, setNewOverlayOpen] = useState(false)
    const [renameOverlayOpen, setRenameOverlayOpen] = useState(false)
    const [editComponentOpen, setEditComponentOpen] = useState(false)
    const [components, setComponents] = useState<any[]>([])
    const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])

    async function loadComponents() {
        try {
            const ovl = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
            const overlayId: string | null = ovl?.ok ? (ovl.data ?? null) : null
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
            try { await window.ipcRenderer.invoke('app:setSelectedOverlayComponentIds', []) } catch {}
            setSelectedComponentIds([])
            loadComponents()
        }
        const onComponentsChanged = () => loadComponents()
        const onSelectedComponentIdsChanged = (e: any) => {
            try {
                const ids = Array.isArray(e?.detail) ? e.detail : []
                setSelectedComponentIds(ids)
            } catch {}
        }
        window.addEventListener('selectedOverlayLayerChanged', onOverlayChanged as any)
        window.addEventListener('overlayComponentsChanged', onComponentsChanged as any)
        window.addEventListener('selectedOverlayComponentIdsChanged', onSelectedComponentIdsChanged as any)
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedOverlayComponentIds')
                if (res?.ok) setSelectedComponentIds(Array.isArray(res.data) ? res.data : [])
            } catch {}
        })()
        return () => {
            window.removeEventListener('selectedOverlayLayerChanged', onOverlayChanged as any)
            window.removeEventListener('overlayComponentsChanged', onComponentsChanged as any)
            window.removeEventListener('selectedOverlayComponentIdsChanged', onSelectedComponentIdsChanged as any)
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
                                <button title="Nodes" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <FaFolderTree className="h-4.5 w-4.5" />
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
                                <CreateCustomTextButton/>
                                <CreateImageButton/>
                                <button title="Time" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <IoIosTime className="h-4.5 w-4.5" />
                                </button>
                                <button title="Date" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <IoCalendar className="h-4.5 w-4.5" />
                                </button>
                                <button title="Data" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <LuCable className="h-4.5 w-4.5" />
                                </button>
                                <button title="Dive" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <FaPersonSwimming className="h-4.5 w-4.5" />
                                </button>
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
                                            } catch {}
                                        } catch {}
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
                                                    alignItems: 'center',
                                                    justifyContent: c.textStyle?.align === 'right' ? 'flex-end' : c.textStyle?.align === 'center' ? 'center' : 'flex-start',
                                                    padding: '4px',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {c.type === 'custom-text' ? (
                                                    <span
                                                        style={{
                                                            fontFamily: c.textStyle?.fontFamily,
                                                            fontSize: c.textStyle?.fontSize,
                                                            fontWeight: c.textStyle?.fontWeight as any,
                                                            fontStyle: c.textStyle?.italic ? 'italic' : undefined,
                                                            textDecoration: c.textStyle?.underline ? 'underline' : undefined,
                                                            color: c.textStyle?.color || '#fff',
                                                            textTransform: c.textStyle?.uppercase ? 'uppercase' : undefined,
                                                            letterSpacing: c.textStyle?.letterSpacing,
                                                            lineHeight: c.textStyle?.lineHeight as any,
                                                        }}
                                                    >
                                                        {c.customText || c.name}
                                                    </span>
                                                ) : c.type === 'image' ? (
                                                    c.imagePath ? (
                                                        <img src={c.imagePath} className="max-w-full max-h-full object-contain" />
                                                    ) : (
                                                        <div className="text-white/60 text-xs">No image</div>
                                                    )
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
                                <button onClick={() => setEditComponentOpen(true)} title="Edit Component" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <MdEdit className="h-4.5 w-4.5" />
                                </button>
                                <button
                                    title="Delete Component(s)"
                                    className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none"
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
                                                } catch { }
                                            }
                                        } catch { }
                                    }}
                                >
                                    <MdDelete className="h-4.5 w-4.5" />
                                </button>
                            </div>
                            <ComponentList/>
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
            >
                <EditComponentForm onClose={() => setEditComponentOpen(false)} />
            </DraggableDialog>
        </div>
    )
}