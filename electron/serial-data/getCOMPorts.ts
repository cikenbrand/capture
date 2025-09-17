export async function getCOMPorts(): Promise<string[]> {
  try {
    const mod: unknown = await import('@serialport/list')
    const listFn = (mod as any).list ?? (mod as any).default ?? mod
    const ports: Array<{ path?: string | null }> = await (listFn as () => Promise<Array<{ path?: string | null }>>)()
    const names: string[] = ports
      .map((p) => p.path)
      .filter((v): v is string => typeof v === 'string' && v.length > 0)

    // Deduplicate and sort naturally by COM number when possible
    const unique: string[] = Array.from(new Set(names))
    unique.sort((a: string, b: string) => {
      const aMatch = /^COM(\d+)$/i.exec(a)
      const bMatch = /^COM(\d+)$/i.exec(b)
      if (aMatch && bMatch) {
        return Number(aMatch[1]) - Number(bMatch[1])
      }
      return a.localeCompare(b)
    })
    return unique
  } catch {
    return []
  }
}

export default getCOMPorts

