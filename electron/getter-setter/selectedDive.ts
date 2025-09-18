let selectedDiveId: string | null = null

export function setSelectedDiveId(id: string | null) {
  selectedDiveId = id ? id.trim() || null : null
}

export function getSelectedDiveId(): string | null {
  return selectedDiveId
}


