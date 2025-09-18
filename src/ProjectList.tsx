import { useEffect, useState } from 'react'

interface ProjectListItem {
  _id: string
  name: string
  client: string
}

interface ProjectListProps {
  selectedId: string | null
  onChange: (id: string) => void
  isOpen?: boolean
}

export default function ProjectList({ selectedId, onChange, isOpen }: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      const res = await window.ipcRenderer.invoke('db:getAllProjects')
      if (mounted && res?.ok) setProjects(res.data as ProjectListItem[])
    }
    if (isOpen) load()
    return () => { mounted = false }
  }, [isOpen])

  return (
    <div className="max-h-64 overflow-auto border rounded">
      {projects.map(p => (
        <label key={p._id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer">
          <input
            type="radio"
            name="selectedProject"
            checked={selectedId === p._id}
            onChange={() => onChange(p._id)}
          />
          <div className="flex flex-col">
            <span className="font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.client}</span>
          </div>
        </label>
      ))}
      {projects.length === 0 && (
        <div className="px-3 py-6 text-center text-muted-foreground">No projects found</div>
      )}
    </div>
  )
}


