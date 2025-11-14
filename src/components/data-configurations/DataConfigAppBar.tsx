import { VscChromeMinimize, VscChromeClose } from "react-icons/vsc";
import { FaRegWindowRestore } from "react-icons/fa";

export default function DataConfigAppBar() {
    return (
        <div className='h-9 w-full drag flex items-center justify-between pl-2 border-b border-slate-700' >
            <div className="h-5 w-5 overflow-hidden rounded">
                <img src="/dc.png" className="object-contain" />
            </div>
            <span className="text-slate-400 relative left-20">Data Configurations</span>
            <div className='flex items-center gap-2 h-full'>
                <button
                    title="Minimize"
                    className='h-full w-12 no-drag flex items-center justify-center text-white hover:bg-white/15'
                    onClick={() => window.ipcRenderer.invoke('data-config-window:minimize')}
                >
                    <VscChromeMinimize className="h-4 w-4 text-white/50" />
                </button>
                <button
                    title="Restore/Maximize"
                    className='h-full w-12 no-drag flex items-center justify-center text-white hover:bg-white/15'
                    onClick={() => window.ipcRenderer.invoke('data-config-window:toggle-maximize')}
                >
                    <FaRegWindowRestore className="h-3 w-3 text-white/50" />
                </button>
                <button
                    title="Close"
                    className='group h-full w-12 no-drag flex items-center justify-center text-white hover:bg-red-600'
                    onClick={() => window.ipcRenderer.invoke('data-config-window:close')}
                >
                    <VscChromeClose className="h-4 w-4 text-white/50 group-hover:text-white" />
                </button>
            </div>
        </div >
    )
}