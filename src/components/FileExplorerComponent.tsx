import { useMemo, useRef, useState, type ReactNode } from "react"
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
    rightActions?: ReactNode
    /**
     * Called when user selects "Save to local" from context menu for an entry.
     * For hierarchy mode, name is the entry key in the current path.
     * currentPath represents the folder path segments at the time of the click.
     */
    onSaveToLocal?: (name: string, isFolder: boolean, currentPath: string[]) => void
}

export default function FileExplorerComponent({ items, onSelect, hierarchy, onOpenPath, rightActions, onSaveToLocal }: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [view, setView] = useState<"details" | "large">("details")
    const [path, setPath] = useState<string[]>([])
    const [ctxOpen, setCtxOpen] = useState<boolean>(false)
    const [ctxPos, setCtxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [ctxItem, setCtxItem] = useState<{ name: string; isFolder: boolean } | null>(null)
    const rootRef = useRef<HTMLDivElement>(null)

    function resolveFileUrl(name: string): string {
        try {
            if (!hierarchy) return ''
            const port = (window as any)?.overlay?.wsPort ?? 3620
            const base = `http://127.0.0.1:${port}/fs?path=`
            let cursor: any = hierarchy
            for (const seg of path) {
                if (!cursor || typeof cursor !== 'object') { cursor = {}; break }
                if (cursor.children && seg in cursor.children) cursor = cursor.children[seg]
                else if (seg in cursor) cursor = cursor[seg]
                else { cursor = {}; break }
            }
            const nodeChildren = (cursor && cursor.children) ? cursor.children : cursor
            const entry = nodeChildren?.[name]
            const fp = entry?.path
            return typeof fp === 'string' ? `${base}${encodeURIComponent(fp)}` : ''
        } catch { return '' }
    }

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
            // Treat everything except explicit file types as navigable folders
            const isFolder = !(type === 'video' || type === 'image')
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
        <div ref={rootRef} className="flex-1 flex flex-col min-h-0 relative" onClick={() => { if (ctxOpen) setCtxOpen(false) }}>
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-[#1F252E] gap-3">
                <div className="flex items-center gap-2">
                    <button
                        className={`h-8 w-8 grid place-items-center rounded text-slate-400 ${path.length ? 'hover:bg-white/10' : 'opacity-40 cursor-default'}`}
                        onClick={() => { if (path.length) { const next = path.slice(0, -1); setPath(next); try { onOpenPath?.(next) } catch {} } }}
                        title="Back"
                    >
                        <VscChevronLeft size={18} />
                    </button>
                    {(["Root", ...path]).map((label, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                            <button
                                className={`px-2 py-1 rounded hover:bg-white/10 ${idx === path.length ? 'text-blue-300' : 'text-slate-400'}`}
                                onClick={() => {
                                    const next = idx === 0 ? [] : path.slice(0, idx)
                                    setPath(next)
                                    try { onOpenPath?.(next) } catch {}
                                }}
                                title={label}
                            >
                                <span className="truncate max-w-[180px] inline-block align-middle">{label}</span>
                            </button>
                            {idx < path.length && <span className="text-slate-400">›</span>}
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Select value={view} onValueChange={(v) => setView(v as any)}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="View" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="details">List</SelectItem>
                            <SelectItem value="large">Large icons</SelectItem>
                        </SelectContent>
                    </Select>
                    {rightActions}
                </div>
            </div>
            {view === 'details' && (
                <div className="px-4 py-2 text-xs uppercase tracking-wider text-slate-400 border-b border-white/10 flex items-center">
                    <span className="flex-1">Name</span>
                    <span className="w-36 text-right">Type</span>
                    <span className="w-48 text-right">Date Modified</span>
                </div>
            )}
            <div className="flex-1 overflow-auto">
                {hierarchy ? (
                    !currentEntries || currentEntries.length === 0 ? (
                        <div className="p-4 text-slate-400">No items</div>
                    ) : view === 'details' ? (
                        <ul className="divide-y divide-white/5">
                            {currentEntries.map((it) => (
                                <li
                                    key={it.key}
                                    className={`px-4 py-2 cursor-default flex items-center ${selectedId === it.key ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                    onClick={() => { setSelectedId(it.key) }}
                                    onContextMenu={(e) => {
                                        e.preventDefault()
                                        setSelectedId(it.key)
                                        setCtxItem({ name: it.key, isFolder: it.isFolder })
                                        const rect = rootRef.current?.getBoundingClientRect()
                                        const x = e.clientX - (rect?.left ?? 0)
                                        const y = e.clientY - (rect?.top ?? 0)
                                        setCtxPos({ x, y })
                                        setCtxOpen(true)
                                    }}
                                    onDoubleClick={() => openEntry(it.key, it.isFolder)}
                                    aria-selected={selectedId === it.key}
                                >
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                {it.type === 'video' ? (
                                    <video className="w-8 h-6 rounded object-cover bg-black/50" src={resolveFileUrl(it.key)} muted preload="metadata" />
                                ) : it.type === 'image' ? (
                                    <img className="w-8 h-6 rounded object-cover bg-black/20" src={resolveFileUrl(it.key)} alt={it.key} />
                                ) : (
                                    <AiFillFolder className="text-yellow-400" size={16} />
                                )}
                                        <span className="text-slate-400 truncate">{it.key}</span>
                                    </div>
                                    <span className="w-36 text-right text-slate-400 capitalize">{it.type || ''}</span>
                                    <span className="w-48 text-right text-slate-400"></span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-3 flex flex-wrap gap-2">
                            {currentEntries.map((it) => (
                                <div
                                    key={it.key}
                                    className={`group rounded cursor-default p-3 w-[140px] flex flex-col items-center gap-2 ${selectedId === it.key ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
                                    onClick={() => { setSelectedId(it.key) }}
                                    onContextMenu={(e) => {
                                        e.preventDefault()
                                        setSelectedId(it.key)
                                        setCtxItem({ name: it.key, isFolder: it.isFolder })
                                        const rect = rootRef.current?.getBoundingClientRect()
                                        const x = e.clientX - (rect?.left ?? 0)
                                        const y = e.clientY - (rect?.top ?? 0)
                                        setCtxPos({ x, y })
                                        setCtxOpen(true)
                                    }}
                                    onDoubleClick={() => openEntry(it.key, it.isFolder)}
                                    aria-selected={selectedId === it.key}
                                >
                                    {it.type === 'video' ? (
                                        <video
                                            className="rounded w-[72px] h-[54px] object-cover bg-black/50"
                                            src={(() => {
                                                try {
                                                    const base = `http://127.0.0.1:3620/fs?path=`
                                                    // Attempt to resolve file path for thumbnail from hierarchy
                                                    let cursor: any = hierarchy
                                                    for (const seg of path) {
                                                        if (!cursor || typeof cursor !== 'object') { cursor = {}; break }
                                                        if (cursor.children && seg in cursor.children) cursor = cursor.children[seg]
                                                        else if (seg in cursor) cursor = cursor[seg]
                                                        else { cursor = {}; break }
                                                    }
                                                    const nodeChildren = (cursor && cursor.children) ? cursor.children : cursor
                                                    const entry = nodeChildren?.[it.key]
                                                    const fp = entry?.path
                                                    return typeof fp === 'string' ? `${base}${encodeURIComponent(fp)}` : ''
                                                } catch { return '' }
                                            })()}
                                            muted
                                            preload="metadata"
                                        />
                                    ) : it.type === 'image' ? (
                                        <img
                                            className="rounded w-[72px] h-[54px] object-cover bg-black/20"
                                            src={(() => {
                                                try {
                                                    const base = `http://127.0.0.1:3620/fs?path=`
                                                    let cursor: any = hierarchy
                                                    for (const seg of path) {
                                                        if (!cursor || typeof cursor !== 'object') { cursor = {}; break }
                                                        if (cursor.children && seg in cursor.children) cursor = cursor.children[seg]
                                                        else if (seg in cursor) cursor = cursor[seg]
                                                        else { cursor = {}; break }
                                                    }
                                                    const nodeChildren = (cursor && cursor.children) ? cursor.children : cursor
                                                    const entry = nodeChildren?.[it.key]
                                                    const fp = entry?.path
                                                    return typeof fp === 'string' ? `${base}${encodeURIComponent(fp)}` : ''
                                                } catch { return '' }
                                            })()}
                                            alt={it.key}
                                        />
                                    ) : (
                                        <AiFillFolder className={`text-yellow-400 ${selectedId === it.key ? 'drop-shadow-[0_0_6px_rgba(255,255,0,0.3)]' : ''}`} size={48} />
                                    )}
                                    <div className={`text-slate-400 text-center w-full truncate ${selectedId === it.key ? 'font-medium' : ''}`} title={it.key}>{it.key}</div>
                                </div>
                            ))}
                        </div>
                    )
                ) : !items.length ? (
                    <div className="p-4 text-slate-400">No items</div>
                ) : view === 'details' ? (
                    <ul className="divide-y divide-white/5">
                        {items.map((it) => (
                            <li
                                key={it.id}
                                className={`px-4 py-2 cursor-default flex items-center ${selectedId === it.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                onClick={() => { setSelectedId(it.id); try { onSelect?.(it.id) } catch {} }}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    setSelectedId(it.id)
                                    setCtxItem({ name: it.name, isFolder: true })
                                    const rect = rootRef.current?.getBoundingClientRect()
                                    const x = e.clientX - (rect?.left ?? 0)
                                    const y = e.clientY - (rect?.top ?? 0)
                                    setCtxPos({ x, y })
                                    setCtxOpen(true)
                                }}
                                onDoubleClick={() => openEntry(it.name, true)}
                                aria-selected={selectedId === it.id}
                            >
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <AiFillFolder className="text-yellow-400" size={16} />
                                    <span className="text-slate-400 truncate">{it.name}</span>
                                </div>
                                <span className="w-48 text-right text-slate-400">{it.dateModified ?? ''}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                        <div className="p-3 flex flex-wrap gap-2">
                        {items.map((it) => (
                            <div
                                key={it.id}
                                className={`group rounded cursor-default p-3 w-[140px] flex flex-col items-center gap-2 ${selectedId === it.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                onClick={() => { setSelectedId(it.id); try { onSelect?.(it.id) } catch {} }}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    setSelectedId(it.id)
                                    setCtxItem({ name: it.name, isFolder: true })
                                    const rect = rootRef.current?.getBoundingClientRect()
                                    const x = e.clientX - (rect?.left ?? 0)
                                    const y = e.clientY - (rect?.top ?? 0)
                                    setCtxPos({ x, y })
                                    setCtxOpen(true)
                                }}
                                onDoubleClick={() => openEntry(it.name, true)}
                                aria-selected={selectedId === it.id}
                            >
                                <AiFillFolder className="text-yellow-400" size={48} />
                                <div className="text-slate-400 text-center w-full truncate" title={it.name}>{it.name}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {ctxOpen && ctxItem ? (
                <div
                    className="absolute z-[5000] min-w-[180px] rounded border border-white/10 bg-[#1E1E1E] shadow-xl"
                    style={{ left: Math.min(ctxPos.x, (rootRef.current?.clientWidth ?? window.innerWidth) - 190), top: Math.min(ctxPos.y, (rootRef.current?.clientHeight ?? window.innerHeight) - 60) }}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <button
                        className="w-full text-left px-3 py-2 text-slate-400 hover:bg-white/10"
                        onClick={() => {
                            try { onSaveToLocal?.(ctxItem.name, ctxItem.isFolder, path) } catch {}
                            setCtxOpen(false)
                        }}
                    >
                        Save to local
                    </button>
                </div>
            ) : null}
        </div>
    )
}


