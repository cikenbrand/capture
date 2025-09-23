import { VscChromeMinimize, VscChromeClose } from "react-icons/vsc";

export default function OverlayWindowBar() {
    return (
        <div className='h-9 w-full drag flex items-center justify-between pl-2' >
            <div className="h-5 w-5 overflow-hidden rounded">
                <img src="/dc.png" className="object-contain" />
            </div>
            <span className="font-semibold">Overlay Editor</span>
            <div className='flex items-center gap-2 h-full'>
                <button
                    className='h-full w-12 no-drag flex items-center justify-center text-white hover:bg-white/15'
                    onClick={() => window.ipcRenderer.invoke('overlay-window:minimize')}
                >
                    <VscChromeMinimize className="h-4 w-4 text-white/50" />
                </button>
                <button
                    className='group h-full w-12 no-drag flex items-center justify-center text-white hover:bg-red-600'
                    onClick={() => window.ipcRenderer.invoke('overlay-window:close')}
                >
                    <VscChromeClose className="h-4 w-4 text-white/50 group-hover:text-white" />
                </button>
            </div>
        </div >
    )
}