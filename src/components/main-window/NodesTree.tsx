import { memo, useEffect, useMemo, useState } from "react"
import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature } from "@headless-tree/core"
import { AssistiveTreeDescription, useTree } from "@headless-tree/react"
import { Tree, TreeItem, TreeItemLabel } from "@/components/ui/tree"

interface Item {
  name: string
  children?: string[]
}

const indent = 20

function TreeContent({ data, expanded, selectedId, onItemClick }: { data: Record<string, Item>, expanded: string[], selectedId: string | null, onItemClick: (id: string, isFolder: boolean) => void }) {
  const features = useMemo(() => [
    syncDataLoaderFeature,
    selectionFeature,
    hotkeysCoreFeature,
  ], [])
  const initialState = useMemo(() => ({
    expandedItems: expanded && expanded.length ? expanded : ['root', 'nodes-root'],
    selectedItems: selectedId ? [selectedId] : [],
  }), [expanded, selectedId])

  const getItem = useMemo(() => (itemId: string) => data[itemId], [data])
  const getChildren = useMemo(() => (itemId: string) => data[itemId]?.children ?? [], [data])
  const dataLoader = useMemo(() => ({ getItem, getChildren }), [getItem, getChildren])

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

  return (
    <Tree
      className="relative before:absolute before:inset-0 before:-ms-1 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),rgba(255,255,255,0.1)_calc(var(--tree-indent)-1px),rgba(255,255,255,0.1)_calc(var(--tree-indent)))]"
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
                try { onItemClick(id, isFolder) } catch {}
                const nextId = id === 'nodes-root' ? null : id
                console.log('[NodesTree] selected node id:', nextId)
                await window.ipcRenderer.invoke('app:setSelectedNodeId', nextId)
                try {
                  const ev = new CustomEvent('selectedNodeChanged', { detail: nextId })
                  window.dispatchEvent(ev)
                } catch {}
              } catch {}
            }}
          >
            <TreeItemLabel className="rounded-none py-1">
              <span className="flex items-center gap-2">{item.getItemName()}</span>
            </TreeItemLabel>
          </TreeItem>
        )
      })}
    </Tree>
  )
}

const MemoTreeContent = memo(TreeContent)

export default function NodesTree() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, Item>>({ root: { name: 'Nodes', children: [] } })
  const [_loading, setLoading] = useState(false)
  const [itemsVersion, setItemsVersion] = useState(0)
  const [expandedIds, setExpandedIds] = useState<string[]>(['root', 'nodes-root'])
  const [pendingExpandIds, setPendingExpandIds] = useState<string[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Keep selected project id in sync
  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        if (!done && res?.ok) setProjectId(res.data ?? null)
      } catch {}
    })()
    const onProjectChanged = (e: any) => {
      try { setProjectId(e?.detail ?? null) } catch {}
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
    const refresh = () => {
      if (cancelled) return
      load()
    }
    async function load() {
      if (!projectId) {
        setItems({ root: { name: 'Nodes', children: [] } })
        setExpandedIds(['root', 'nodes-root'])
        return
      }
      setLoading(true)
      try {
        const [proj, res] = await Promise.all([
          window.ipcRenderer.invoke('db:getSelectedProjectDetails', projectId),
          window.ipcRenderer.invoke('db:getAllNodes', projectId),
        ])
        if (cancelled) return
        const rootName = proj?.ok && proj?.data?.name ? String(proj.data.name) : 'Nodes'
        if (res?.ok) {
          const roots = (res.data || []) as Array<{ _id: string, name: string, children: any[] }>
          const next: Record<string, Item> = { root: { name: rootName, children: [] } }
          const parentOf: Record<string, string | undefined> = {}

          const walk = (node: any, parentId?: string) => {
            const id = String(node._id)
            const childIds: string[] = Array.isArray(node.children) ? node.children.map((c: any) => c._id?.toString?.() ?? c._id) : []
            next[id] = { name: node.name, children: childIds }
            if (parentId) parentOf[id] = parentId
            if (Array.isArray(node.children)) node.children.forEach((c: any) => walk(c, id))
            return id
          }

          const topIds = roots.map((n) => walk(n))
          const nodesContainerId = 'nodes-root'
          next[nodesContainerId] = { name: 'Nodes', children: topIds }
          next.root.children = [nodesContainerId]
          topIds.forEach((id) => { parentOf[id] = nodesContainerId })
          parentOf[nodesContainerId] = 'root'

          setItems(next)
          // Re-expand to the path of the currently selected node
          try {
            const selRes = await window.ipcRenderer.invoke('app:getSelectedNodeId')
            const selId: string | null = selRes?.ok ? (selRes.data ?? null) : null
            setSelectedId(selId)
            const expandedPath: string[] = ['root', 'nodes-root']
            let cur: string | undefined = selId ?? undefined
            let guard = 0
            while (cur && parentOf[cur] && guard++ < 1000) {
              const parent = parentOf[cur]
              if (parent) expandedPath.push(parent)
              cur = parent
            }
            const combined = new Set(expandedPath)
            if (pendingExpandIds && pendingExpandIds.length) {
              pendingExpandIds.forEach(id => combined.add(id))
            }
            setExpandedIds(Array.from(combined))
            setPendingExpandIds(null)
          } catch {}
          setItemsVersion(v => v + 1)
        } else {
          const nodesContainerId = 'nodes-root'
          setItems({
            root: { name: rootName, children: [nodesContainerId] },
            [nodesContainerId]: { name: 'Nodes', children: [] },
          })
          setItemsVersion(v => v + 1)
          setExpandedIds(['root', 'nodes-root'])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    window.addEventListener('nodesChanged', refresh as any)
    return () => { cancelled = true; window.removeEventListener('nodesChanged', refresh as any) }
  }, [projectId])

  return (
    <div className="flex h-full flex-col gap-2 *:first:grow">
      <div>
        <MemoTreeContent
          key={itemsVersion}
          data={items}
          expanded={expandedIds}
          selectedId={selectedId}
          onItemClick={(id, isFolder) => {
            if (isFolder) {
              setPendingExpandIds((prev) => {
                const next = new Set(prev || [])
                next.add(id)
                return Array.from(next)
              })
            }
          }}
        />
      </div>
    </div>
  )
}