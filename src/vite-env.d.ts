/// <reference types="vite/client" />

interface IpcRendererAPI {
	on: typeof import('electron').ipcRenderer.on
	off: typeof import('electron').ipcRenderer.off
	send: typeof import('electron').ipcRenderer.send
	invoke: typeof import('electron').ipcRenderer.invoke
}

declare global {
	interface Window {
		ipcRenderer: IpcRendererAPI
	}
}