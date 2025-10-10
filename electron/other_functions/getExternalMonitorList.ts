import { app, screen } from 'electron'

export async function getExternalMonitorList(): Promise<string[]> {
  try {
    if (!app.isReady()) {
      await app.whenReady()
    }

    const displays = screen.getAllDisplays().filter(d => !d.internal)
    const labels = displays
      .map(d => (d.label ?? '').trim())
      .filter((name): name is string => Boolean(name))

    const unique = Array.from(new Set(labels))
    unique.sort((a, b) => a.localeCompare(b))
    return unique
  } catch (error) {
    console.error('Failed to list external monitors:', error)
    return []
  }
}


