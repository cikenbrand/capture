import { useMemo, useState } from "react"
import { VscChevronLeft } from "react-icons/vsc"
import { AiFillFolder, AiOutlineFile } from "react-icons/ai"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type FileExplorerItem = {
    id: string
    name: string
    dateModified?: string
}

type Props = {
    items: FileExplorerItem[]
    onSelect?: (id: string) => void
    hierarchy?: Record<string, any>
    onOpenPath?: (path: string[]) => void
}

export default function FileExplorerComponent({ items, onSelect, hierarchy, onOpenPath }: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [view, setView] = useState<"details" | "large">("details")
    const [path, setPath] = useState<string[]>([])

    const currentEntries = useMemo(() => {
        if (!hierarchy) return null as null | Array<{ key: string; isFolder: boolean; type?: string }>
        let cursor: any = hierarchy
        for (const seg of path) {
            if (!cursor || typeof cursor !== 'object') { cursor = {}; break }
            if (cursor.children && seg in cursor.children) {
                cursor = cursor.children[seg]
            } else if (seg in cursor) {
                cursor = cursor[seg]
            } else {
                cursor = {}
                break
            }
        }
        const nodeChildren = (cursor && cursor.children) ? cursor.children : cursor
        const keys = Object.keys(nodeChildren || {})
        keys.sort((a, b) => a.localeCompare(b))
        return keys.map(k => {
            const entry = nodeChildren?.[k]
            const type = entry?.type as string | undefined
            // Treat everything except explicit video files as navigable folders
            const isFolder = type !== 'video'
            return { key: k, isFolder, type }
        })
    }, [hierarchy, path])

    function openEntry(name: string, isFolder: boolean) {
        if (hierarchy && isFolder) {
            const next = [...path, name]
            setPath(next)
            try { onOpenPath?.(next) } catch {}
        } else {
            // For non-hierarchy mode or leaf nodes, just call onSelect with composed id/name
            try { onSelect?.(name) } catch {}
        }
    }

    // Icons are uniform folder icons per request

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-[#1F252E] gap-3">
                <div className="flex items-center gap-2 text-sm">
                    <button
                        className={`h-8 w-8 grid place-items-center rounded ${path.length ? 'hover:bg-white/10 text-white' : 'opacity-40 cursor-default text-white/70'}`}
                        onClick={() => { if (path.length) { const next = path.slice(0, -1); setPath(next); try { onOpenPath?.(next) } catch {} } }}
                        title="Back"
                    >
                        <VscChevronLeft size={18} />
                    </button>
                    {(["Root", ...path]).map((label, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                            <button
                                className={`px-2 py-1 rounded hover:bg-white/10 text-white/80 ${idx === path.length ? 'font-semibold text-white' : ''}`}
                                onClick={() => {
                                    const next = idx === 0 ? [] : path.slice(0, idx)
                                    setPath(next)
                                    try { onOpenPath?.(next) } catch {}
                                }}
                                title={label}
                            >
                                <span className="truncate max-w-[180px] inline-block align-middle">{label}</span>
                            </button>
                            {idx < path.length && <span className="text-white/40">›</span>}
                        </div>
                    ))}
                </div>
                <Select value={view} onValueChange={(v) => setView(v as any)}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="View" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="details">List</SelectItem>
                        <SelectItem value="large">Large icons</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {view === 'details' && (
                <div className="px-4 py-2 text-xs uppercase tracking-wider text-white/60 border-b border-white/10 flex items-center">
                    <span className="flex-1">Name</span>
                    <span className="w-36 text-right">Type</span>
                    <span className="w-48 text-right">Date Modified</span>
                </div>
            )}
            <div className="flex-1 overflow-auto">
                {hierarchy ? (
                    !currentEntries || currentEntries.length === 0 ? (
                        <div className="p-4 text-white/60 text-sm">No items</div>
                    ) : view === 'details' ? (
                        <ul className="divide-y divide-white/5">
                            {currentEntries.map((it) => (
                                <li
                                    key={it.key}
                                    className={`px-4 py-2 cursor-default flex items-center ${selectedId === it.key ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                    onClick={() => { setSelectedId(it.key) }}
                                    onDoubleClick={() => openEntry(it.key, it.isFolder)}
                                    aria-selected={selectedId === it.key}
                                >
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                        {it.type === 'video' ? (
                                            <AiOutlineFile className="text-white/70" size={16} />
                                        ) : (
                                            <AiFillFolder className="text-yellow-400" size={16} />
                                        )}
                                        <span className="text-white text-sm truncate">{it.key}</span>
                                    </div>
                                    <span className="w-36 text-right text-white/60 capitalize">{it.type || ''}</span>
                                    <span className="w-48 text-right text-white/50"></span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                            {currentEntries.map((it) => (
                                <div
                                    key={it.key}
                                    className={`group rounded cursor-default p-3 flex flex-col items-center gap-2 ${selectedId === it.key ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
                                    onClick={() => { setSelectedId(it.key) }}
                                    onDoubleClick={() => openEntry(it.key, it.isFolder)}
                                    aria-selected={selectedId === it.key}
                                >
                                    {it.type === 'video' ? (
                                        <AiOutlineFile className="text-white/70" size={48} />
                                    ) : (
                                        <AiFillFolder className={`text-yellow-400 ${selectedId === it.key ? 'drop-shadow-[0_0_6px_rgba(255,255,0,0.3)]' : ''}`} size={48} />
                                    )}
                                    <div className={`text-white text-xs text-center w-full truncate ${selectedId === it.key ? 'font-medium' : ''}`} title={it.key}>{it.key}</div>
                                </div>
                            ))}
                        </div>
                    )
                ) : !items.length ? (
                    <div className="p-4 text-white/60 text-sm">No items</div>
                ) : view === 'details' ? (
                    <ul className="divide-y divide-white/5">
                        {items.map((it) => (
                            <li
                                key={it.id}
                                className={`px-4 py-2 cursor-default flex items-center ${selectedId === it.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                onClick={() => { setSelectedId(it.id); try { onSelect?.(it.id) } catch {} }}
                                onDoubleClick={() => openEntry(it.name, true)}
                                aria-selected={selectedId === it.id}
                            >
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <AiFillFolder className="text-yellow-400" size={16} />
                                    <span className="text-white text-sm truncate">{it.name}</span>
                                </div>
                                <span className="w-48 text-right text-white/50">{it.dateModified ?? ''}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {items.map((it) => (
                            <div
                                key={it.id}
                                className={`group rounded cursor-default p-3 flex flex-col items-center gap-2 ${selectedId === it.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                onClick={() => { setSelectedId(it.id); try { onSelect?.(it.id) } catch {} }}
                                onDoubleClick={() => openEntry(it.name, true)}
                                aria-selected={selectedId === it.id}
                            >
                                <AiFillFolder className="text-yellow-400" size={48} />
                                <div className="text-white text-xs text-center w-full truncate" title={it.name}>{it.name}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}


