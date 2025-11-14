import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@/components/ui/menubar";
import { VscChromeMinimize, VscChromeClose } from "react-icons/vsc";
import { FaRegWindowRestore } from "react-icons/fa";
import { toast } from "sonner";

export default function OverlayWindowBar() {
    return (
        <div className='h-9 w-full drag flex items-center justify-between pl-2 border-b border-slate-700' >
			<div className="flex gap-2 w-full items-center">
				<div className="h-5 w-5 overflow-hidden rounded">
					<img src="/dc.png" className="object-contain" />
				</div>
				<Menubar className='no-drag h-6 bg-transparent border-0 p-0 shadow-none text-white'>
					<MenubarMenu>
						<MenubarTrigger>File</MenubarTrigger>
						<MenubarContent>
							<MenubarItem
								onClick={async () => {
									try {
										const file = await window.ipcRenderer.invoke('dialog:openJsonFile')
										if (!file?.ok) return
										const filePath = String(file.data || '')
										if (!filePath.toLowerCase().endsWith('.json')) {
											toast.error('Please select a .json overlay file')
											return
										}
										const res = await window.ipcRenderer.invoke('db:importOverlay', { sourcePath: filePath })
										if (!res?.ok) {
											toast.error(res?.error || 'Failed to import overlay')
											return
										}
										toast.success('Overlay imported')
										try { const ev = new CustomEvent('overlaysChanged', { detail: { id: res.data?.overlayId, action: 'created' } }); window.dispatchEvent(ev) } catch {}
									} catch (err) {
										toast.error('Failed to import overlay')
									}
								}}
							>
								Import Overlay
							</MenubarItem>
							<MenubarItem
								onClick={async () => {
									try {
										const sel = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
										const selectedOverlayId: string | null = sel?.ok ? (sel.data ?? null) : null
										if (!selectedOverlayId) return
										const dir = await window.ipcRenderer.invoke('dialog:selectDirectory')
										if (!dir?.ok || !dir.data) return
										let overlayName = 'overlay'
										try {
											const all = await window.ipcRenderer.invoke('db:getAllOverlay')
											const match = all?.ok && Array.isArray(all.data) ? all.data.find((o: any) => String(o._id) === String(selectedOverlayId)) : null
											overlayName = match?.name ? String(match.name) : 'overlay'
										} catch {}
										const safe = overlayName.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'overlay'
										const destination = `${dir.data}\\${safe}.json`
										const res = await window.ipcRenderer.invoke('db:exportOverlay', { destPath: destination, overlayId: selectedOverlayId })
										if (!res?.ok) {
											console.warn('Export failed:', res?.error)
										}
									} catch {}
								}}
							>
								Export Overlay
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>
            </div>
			<div className="w-full flex items-center relative">
				<span className="text-slate-400">Overlay Editor</span>
			</div>
            <div className='flex items-center gap-2 h-full'>
                <button
                    title="Minimize"
                    className='h-full w-12 no-drag flex items-center justify-center text-white hover:bg-white/15'
                    onClick={() => window.ipcRenderer.invoke('overlay-window:minimize')}
                >
                    <VscChromeMinimize className="h-4 w-4 text-white/50" />
                </button>
                <button
                    title="Restore/Maximize"
                    className='h-full w-12 no-drag flex items-center justify-center text-white hover:bg-white/15'
                    onClick={() => window.ipcRenderer.invoke('overlay-window:toggle-maximize')}
                >
                    <FaRegWindowRestore className="h-3 w-3 text-white/50" />
                </button>
                <button
                    title="Close"
                    className='group h-full w-12 no-drag flex items-center justify-center text-white hover:bg-red-600'
                    onClick={() => window.ipcRenderer.invoke('overlay-window:close')}
                >
                    <VscChromeClose className="h-4 w-4 text-white/50 group-hover:text-white" />
                </button>
            </div>
        </div >
    )
}