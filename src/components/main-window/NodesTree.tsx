import { memo, useEffect, useMemo, useRef, useState } from "react"
import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature } from "@headless-tree/core"
import { AssistiveTreeDescription, useTree } from "@headless-tree/react"
import { Tree, TreeItem, TreeItemLabel } from "@/components/ui/tree"

interface Item {
  name: string
  children?: string[]
  status?: 'completed' | 'ongoing' | 'not-started'
}

const indent = 20

function TreeContent({ data, expanded, selectedId, onItemClick }: { data: Record<string, Item>, expanded: string[], selectedId: string | null, onItemClick: (id: string, isFolder: boolean, pathNames: string[]) => void }) {
  const features = useMemo(() => [
    syncDataLoaderFeature,
    selectionFeature,
    hotkeysCoreFeature,
  ], [])
  const initialState = useMemo(() => ({
    expandedItems: expanded && expanded.length ? expanded : ['root', 'project-root'],
    selectedItems: selectedId ? [selectedId] : [],
  }), [expanded, selectedId])

  const getItem = useMemo(() => (itemId: string) => data[itemId] ?? { name: '', children: [] }, [data])
  const getChildren = useMemo(() => (itemId: string) => data[itemId]?.children ?? [], [data])
  const dataLoader = useMemo(() => ({ getItem, getChildren }), [getItem, getChildren])

  // Build parent map from children relationships for quick upward traversal
  const parentOf = useMemo(() => {
    const p: Record<string, string | undefined> = {}
    try {
      Object.keys(data).forEach((pid) => {
        const ch = data[pid]?.children || []
        ch.forEach((cid) => { p[cid] = pid })
      })
    } catch { }
    return p
  }, [data])

  const tree = useTree<Item>({
    initialState,
    indent,
    rootItemId: "root",
    getItemName: (item) => item.getItemData()?.name ?? "",
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    canReorder: false,
    onDrop: undefined,
    dataLoader,
    features,
  })

  // Drive expansion/selection from props when they change, without remounting the tree
  useEffect(() => {
    try {
      const next = expanded && expanded.length ? expanded : ["root", "project-root"]
      const uniq = Array.from(new Set(next))
        ; (tree as any).setExpandedItems?.(uniq)
    } catch { }
  }, [expanded, tree])

  useEffect(() => {
    try {
      const sel = selectedId ? [selectedId] : []
        ; (tree as any).setSelectedItems?.(sel)
    } catch { }
  }, [selectedId, tree])

  return (
    <div className="border border-white/10 h-[630px] overflow-y-auto logs-scroll">
      <Tree
        className="relative before:absolute before:top-0 before:bottom-0 before:left-[var(--tree-indent)] before:right-0 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),rgba(255,255,255,0.1)_calc(var(--tree-indent)-1px),rgba(255,255,255,0.1)_calc(var(--tree-indent)))]"
        indent={indent}
        tree={tree}
      >
        <AssistiveTreeDescription tree={tree} />
        {tree.getItems().map((item) => {
          return (
            <TreeItem
              key={item.getId()}
              item={item}
              className="pb-0!"
              onClickCapture={async () => {
                try {
                  const id = item.getId()
                  const isFolder = typeof item.isFolder === 'function' ? (item.isFolder() || false) : false
                  const nextId = (id === 'root' || id === 'project-root') ? null : id
                  console.log('[NodesTree] selected node id:', nextId)
                  // Log hierarchical levels from top to selected
                  let pathNames: string[] = []
                  if (nextId) {
                    const pathIds: string[] = []
                    let cur: string | undefined = nextId
                    let guard = 0
                    while (cur && cur !== 'project-root' && cur !== 'root' && guard++ < 1000) {
                      pathIds.push(cur)
                      cur = parentOf[cur]
                    }
                    pathNames = pathIds.reverse().map((nid) => data[nid]?.name || '')
                    if (pathNames.length) {
                      const parts = pathNames.map((nm, idx) => `level ${idx + 1}: ${nm}`)
                      console.log(parts.join(', '))
                    }
                  }
                  try { onItemClick(id, isFolder, pathNames) } catch { }
                  await window.ipcRenderer.invoke('app:setSelectedNodeId', nextId)
                  try {
                    const ev = new CustomEvent('selectedNodeChanged', { detail: nextId })
                    window.dispatchEvent(ev)
                  } catch { }
                  // persist last selected node on project
                  try {
                    const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                    const pid = res?.ok ? (res.data ?? null) : null
                    if (pid) {
                      await window.ipcRenderer.invoke('db:editProject', pid, { lastSelectedNodeId: nextId })
                    }
                  } catch { }
                } catch { }
              }}
            >
              <TreeItemLabel className="text-left">
                <span className="flex items-center gap-2 w-full justify-between">
                  <span className="flex-1 min-w-0 max-w-[240px] truncate whitespace-nowrap text-left">{item.getItemName() || '(deleted)'}</span>
                  {(() => {
                    const id = item.getId()
                    const isRoot = id === 'root' || id === 'project-root'
                    if (isRoot) return null
                    const status = (data as any)[id]?.status as string | undefined
                    const color = status === 'completed' ? '#22c55e' : status === 'ongoing' ? '#3b82f6' : '#9ca3af'
                    return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  })()}
                </span>
              </TreeItemLabel>
            </TreeItem>
          )
        })}
      </Tree>
    </div>
  )
}

const MemoTreeContent = memo(TreeContent)

export default function NodesTree() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, Item>>({ root: { name: 'Project', children: ['project-root'] }, 'project-root': { name: 'Project', children: [] } })
  const [_loading, setLoading] = useState(false)
  const [itemsVersion, setItemsVersion] = useState(0)
  const [expandedIds, setExpandedIds] = useState<string[]>(['root', 'project-root'])
  const [pendingExpandIds, setPendingExpandIds] = useState<string[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isRecordingStarted, setIsRecordingStarted] = useState(false)
  const pendingSelectIdRef = useRef<string | null>(null)
  const pendingFocusParentIdRef = useRef<string | null>(null)
  const expandedIdsRef = useRef<string[]>(['root', 'project-root'])

  useEffect(() => { expandedIdsRef.current = expandedIds }, [expandedIds])

  // WebSocket connections per overlay channel (1..4) to send node selection path
  const socketsRef = useRef<Record<number, WebSocket | null>>({})
  const WS_HOST = '127.0.0.1'
  const WS_PORT = 3620

  function getSocket(channelIndex: number): WebSocket | null {
    const existing = socketsRef.current[channelIndex]
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing
    }
    try {
      const ws = new WebSocket(`ws://${WS_HOST}:${WS_PORT}/overlay?ch=${channelIndex}`)
      ws.addEventListener('close', () => {
        try { if (socketsRef.current[channelIndex] === ws) socketsRef.current[channelIndex] = null } catch { }
      })
      ws.addEventListener('error', () => {
        try { /* ignore */ } catch { }
      })
      socketsRef.current[channelIndex] = ws
      return ws
    } catch {
      return existing ?? null
    }
  }

  function broadcastNodeLevels(levelNames: string[]) {
    const payload = JSON.stringify({ nodeLevels: levelNames })
    for (const ch of [1, 2, 3, 4]) {
      try {
        const ws = getSocket(ch)
        if (!ws || typeof (ws as any).send !== 'function') continue
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload)
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.addEventListener('open', () => {
            try { ws.send(payload) } catch { }
          }, { once: true })
        }
      } catch { }
    }
  }

  // Keep selected project id in sync
  useEffect(() => {
    let done = false
      ; (async () => {
        try {
          const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
          if (!done && res?.ok) setProjectId(res.data ?? null)
        } catch { }
      })()
    const onProjectChanged = (e: any) => {
      try { setProjectId(e?.detail ?? null) } catch { }
    }
    window.addEventListener('selectedProjectChanged', onProjectChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedProjectChanged', onProjectChanged as any)
    }
  }, [])

  // Fetch nodes for the selected project and flatten to items record
  useEffect(() => {
    let cancelled = false
    const refresh = (e?: any) => {
      if (cancelled) return
      try {
        const action = e?.detail?.action as string | undefined
        const newId = e?.detail?.id as string | undefined
        const parentId = e?.detail?.parentId as string | undefined
        if (action === 'deleted') {
          pendingSelectIdRef.current = parentId ?? null
          pendingFocusParentIdRef.current = parentId ?? null
        } else if (action === 'created') {
          // Keep parent selected after adding an item
          pendingSelectIdRef.current = parentId ?? null
          pendingFocusParentIdRef.current = parentId ?? null
        } else if (newId) {
          pendingSelectIdRef.current = newId
        }
      } catch { }
      load()
    }
    async function load() {
      if (!projectId) {
        // Clear tree when no project is selected
        setItems({ root: { name: 'Project', children: ['project-root'] }, 'project-root': { name: 'Project', children: [] } })
        setExpandedIds(['root', 'project-root'])
        setSelectedId(null)
        setItemsVersion(v => v + 1)
        return
      }
      setLoading(true)
      try {
        const [proj, res] = await Promise.all([
          window.ipcRenderer.invoke('db:getSelectedProjectDetails', projectId),
          window.ipcRenderer.invoke('db:getAllNodes', projectId),
        ])
        if (cancelled) return
        const rootName = proj?.ok && proj?.data?.name ? String(proj.data.name) : 'Project'
        if (res?.ok) {
          const roots = (res.data || []) as Array<{ _id: string, name: string, children: any[] }>
          const next: Record<string, Item> = { root: { name: rootName, children: ['project-root'] }, 'project-root': { name: rootName, children: [] } }
          const parentOf: Record<string, string | undefined> = {}

          const walk = (node: any, parentId?: string) => {
            const id = String(node._id)
            const childIds: string[] = Array.isArray(node.children) ? node.children.map((c: any) => c._id?.toString?.() ?? c._id) : []
            next[id] = { name: node.name, children: childIds, status: (node as any).status || 'not-started' }
            if (parentId) parentOf[id] = parentId
            if (Array.isArray(node.children)) node.children.forEach((c: any) => walk(c, id))
            return id
          }

          const topIds = roots.map((n) => walk(n))
          next['project-root'].children = topIds
          topIds.forEach((id) => { parentOf[id] = 'project-root' })
          parentOf['project-root'] = 'root'

          setItems(next)
          // Re-expand to the path of the currently selected node or pending new node
          try {
            const selRes = await window.ipcRenderer.invoke('app:getSelectedNodeId')
            const selId: string | null = selRes?.ok ? (selRes.data ?? null) : null
            const targetId = pendingSelectIdRef.current || selId
            setSelectedId(targetId ?? null)
            const expandedPath: string[] = ['root', 'project-root']
            if (targetId) expandedPath.push(targetId)
            let cur: string | undefined = targetId ?? undefined
            let guard = 0
            while (cur && parentOf[cur] && guard++ < 1000) {
              const parent = parentOf[cur]
              if (parent) expandedPath.push(parent)
              cur = parent
            }
            const combined = new Set(expandedPath)
            // Keep only the current focus path to avoid unintended global expansion
            if (pendingFocusParentIdRef.current) combined.add(pendingFocusParentIdRef.current)
            setExpandedIds(Array.from(combined))
            setPendingExpandIds(null)
            pendingSelectIdRef.current = null
            pendingFocusParentIdRef.current = null
          } catch { }
          setItemsVersion(v => v + 1)
        } else {
          setItems({
            root: { name: rootName, children: ['project-root'] },
            'project-root': { name: rootName, children: [] },
          })
          setItemsVersion(v => v + 1)
          setExpandedIds(['root', 'project-root'])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    window.addEventListener('nodesChanged', refresh as any)
    return () => { cancelled = true; window.removeEventListener('nodesChanged', refresh as any) }
  }, [projectId])

  // Track recording state; disable interactions when recording is started
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

  return (
    <div className={`flex h-full flex-col gap-2 *:first:grow ${isRecordingStarted ? 'pointer-events-none' : ''}`}>
      {projectId ? (
        <div>
          <MemoTreeContent
            key={itemsVersion}
            data={items}
            expanded={expandedIds}
            selectedId={selectedId}
            onItemClick={(id, isFolder, pathNames) => {
              if (isRecordingStarted) return
              if (isFolder) {
                setPendingExpandIds((prev) => {
                  const next = new Set(prev || [])
                  next.add(id)
                  return Array.from(next)
                })
              }
              if (Array.isArray(pathNames) && pathNames.length) {
                try { broadcastNodeLevels(pathNames) } catch { }
              }
            }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-slate-500 border border-white/10">
          No project selected
        </div>
      )}
    </div>
  )
}