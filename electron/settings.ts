import path from 'node:path'

export const OBS_EXECUTABLE_PATH = 'D:\\obs\\build_x64\\rundir\\Release\\bin\\64bit\\obs64.exe'.replace(/\\/g, '\\')
export const OBS_WORKING_DIR = 'D:\\obs\\build_x64\\rundir\\Release\\bin\\64bit'.replace(/\\/g, '\\')
export const OBS_WEBSOCKET_URL = 'ws://127.0.0.1:4455' 
export const OBS_LAUNCH_PARAMS = ['--startvirtualcam', '--disable-shutdown-check']
export const OBS_BASIC_INI_PATH = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'),
  'obs-studio',
  'basic',
  'profiles',
  'Default',
  'basic.ini',
)

export const OVERLAY_WS_PORT = 3620

export const MONGODB_URI = 'mongodb://localhost:27017/capture'

export const SPLASHSCREEN_DURATION_MS = 5000
