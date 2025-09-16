import { BrowserWindow } from "electron"
import path from "node:path"

let splash: BrowserWindow | null = null

export function createSplashWindow(timeoutMs: number): BrowserWindow {
  splash = new BrowserWindow({
    width: 360,
    height: 240,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    transparent: false,
    backgroundColor: "#121212",
    alwaysOnTop: true,
    skipTaskbar: true,
  })

  const publicRoot =
    process.env.VITE_PUBLIC ||
    path.join(process.env.APP_ROOT || process.cwd(), "public")
  const splashFile = path.join(publicRoot, "htmls", "splashscreen.html")
  splash.loadFile(splashFile)

  splash.once("ready-to-show", () => splash?.show())

  // attach timeout info ke window object → boleh check kat createWindow()
  ;(splash as any).timeoutMs = timeoutMs

  return splash
}
