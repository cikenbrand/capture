import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { OBS_EXECUTABLE_PATH, OBS_LAUNCH_PARAMS } from '../settings'
import { OBS_WORKING_DIR } from '../settings'

export function openObs(): number {

  if (!fs.existsSync(OBS_EXECUTABLE_PATH)) {
    throw new Error(`OBS executable not found at: ${OBS_EXECUTABLE_PATH}`)
  }
  if (!fs.existsSync(OBS_WORKING_DIR)) {
    throw new Error(`Working directory does not exist: ${OBS_WORKING_DIR}`)
  }

  const child = spawn(OBS_EXECUTABLE_PATH, OBS_LAUNCH_PARAMS, {
    cwd: OBS_WORKING_DIR,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })

  child.unref()
  return child.pid ?? -1
}
