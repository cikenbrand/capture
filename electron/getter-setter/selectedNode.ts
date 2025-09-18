let selectedNodeId: string | null = null

export function setSelectedNodeId(id: string | null) {
  selectedNodeId = id ? id.trim() || null : null
}

export function getSelectedNodeId(): string | null {
  return selectedNodeId
}


