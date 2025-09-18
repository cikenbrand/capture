let selectedProjectId: string | null = null

export function setSelectedProjectId(id: string | null) {
  selectedProjectId = id ? id.trim() || null : null
}

export function getSelectedProjectId(): string | null {
  return selectedProjectId
}


