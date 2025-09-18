import { useEffect, useMemo, useState } from 'react'

export interface UITreeNode {
  _id: string
  projectId: string
  parentId?: string
  name: string
  level: number
  createdAt: string | Date
  updatedAt: string | Date
  children: UITreeNode[]
}

interface NodesTreeProps {
  projectId: string
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span style={{ display: 'inline-block', transition: 'transform 120ms', transform: `rotate(${open ? 90 : 0}deg)` }}>
      ▶
    </span>
  )
}

export default function NodesTree({ projectId }: NodesTreeProps) {
  const [tree, setTree] = useState<UITreeNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let mounted = true
    async function load() {
      const res = await window.ipcRenderer.invoke('db:getAllNodes', projectId)
      if (mounted && res?.ok) {
        setTree(res.data as UITreeNode[])
      }
    }
    if (projectId) load()
    return () => { mounted = false }
  }, [projectId])

  const rows = useMemo(() => flatten(tree, expanded), [tree, expanded])

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="text-sm">
      {rows.map(row => (
        <div key={row._id} className="flex items-center" style={{ paddingLeft: row.level * 12 }}>
          {row.children.length > 0 ? (
            <button className="mr-1" onClick={() => toggle(row._id)}>
              <Chevron open={!!expanded[row._id]} />
            </button>
          ) : (
            <span className="mr-1" style={{ width: 14 }} />
          )}
          <span>{row.name}</span>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="text-muted-foreground">No nodes</div>
      )}
    </div>
  )
}

function flatten(nodes: UITreeNode[], expanded: Record<string, boolean>): UITreeNode[] {
  const out: UITreeNode[] = []
  const walk = (n: UITreeNode) => {
    out.push(n)
    if (n.children?.length && expanded[n._id]) {
      for (const c of n.children) walk(c)
    }
  }
  for (const n of nodes) walk(n)
  return out
}


