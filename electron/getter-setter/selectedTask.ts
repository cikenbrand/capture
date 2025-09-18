let selectedTaskId: string | null = null

export function setSelectedTaskId(id: string | null) {
  selectedTaskId = id ? id.trim() || null : null
}

export function getSelectedTaskId(): string | null {
  return selectedTaskId
}


