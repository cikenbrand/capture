import { spawnSync } from 'node:child_process'

/**
 * Check whether OBS is currently running.
 * Returns true if a process named 'obs64.exe' or 'obs.exe' is found.
 * Works on Windows; basic fallbacks are provided for macOS/Linux.
 */
export function checkIfOBSOpenOrNot(): boolean {
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('tasklist', [], { encoding: 'utf8' })
      const output = (result.stdout || '').toLowerCase()
      if (!output) return false
      return output.includes('obs64.exe') || output.includes('obs.exe')
    }

    // Fallbacks for non-Windows
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const result = spawnSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8' })
      const lines = (result.stdout || '').toLowerCase().split('\n')
      return lines.some(name => name.includes('obs'))
    }

    return false
  } catch (_err) {
    return false
  }
}

