import { ipcMain } from 'electron'

export type DrawTool = 'select' | 'arrow' | 'circle' | 'free' | 'rect' | 'eraser'

let selectedDrawingTool: DrawTool | null = null

export function setSelectedDrawingTool(tool: DrawTool | null) {
	selectedDrawingTool = tool
}

export function getSelectedDrawingTool(): DrawTool | null {
	return selectedDrawingTool
}

ipcMain.handle('app:setSelectedDrawingTool', async (_event, tool: DrawTool | null) => {
	try {
		setSelectedDrawingTool(tool)
		return { ok: true }
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		return { ok: false, error: message }
	}
})

ipcMain.handle('app:getSelectedDrawingTool', async () => {
	try {
		return { ok: true, data: getSelectedDrawingTool() }
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error'
		return { ok: false, error: message }
	}
})


