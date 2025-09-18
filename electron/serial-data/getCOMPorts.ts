import { SerialPort } from 'serialport'

export async function getCOMPorts(): Promise<string[]> {
  try {
    const ports = await SerialPort.list()
    const comPaths = ports
      .map(p => p.path)
      .filter((p): p is string => Boolean(p))
      .filter(p => /^COM\d+$/i.test(p))

    // Ensure unique and sort by numeric suffix (COM3, COM10, ...)
    const unique = Array.from(new Set(comPaths))
    unique.sort((a, b) => {
      const an = parseInt(a.replace(/^[^0-9]*/, ''), 10)
      const bn = parseInt(b.replace(/^[^0-9]*/, ''), 10)
      if (Number.isNaN(an) || Number.isNaN(bn)) return a.localeCompare(b)
      return an - bn || a.localeCompare(b)
    })
    return unique
  } catch (error) {
    console.error('Failed to list COM ports:', error)
    return []
  }
}


