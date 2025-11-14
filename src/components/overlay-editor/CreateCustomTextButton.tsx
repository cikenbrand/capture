import { useEffect, useState } from "react";
import { MdOutlineTextFields } from "react-icons/md";

export default function CreateCustomTextButton() {
    const [overlayId, setOverlayId] = useState<string | null>(null)
    const disabled = !overlayId

    useEffect(() => {
        let done = false
        ; (async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
                const id: string | null = res?.ok ? (res.data ?? null) : null
                if (!done) setOverlayId(id)
            } catch { }
        })()
        const onSelectedOverlayChanged = (e: any) => {
            try {
                const id = e?.detail ?? null
                setOverlayId(id)
            } catch { }
        }
        window.addEventListener('selectedOverlayLayerChanged', onSelectedOverlayChanged as any)
        return () => window.removeEventListener('selectedOverlayLayerChanged', onSelectedOverlayChanged as any)
    }, [])

    async function onCreate() {
        if (!overlayId) return
        try {
            const res = await window.ipcRenderer.invoke('db:createOverlayComponent', {
                overlayId,
                type: 'custom-text',
            })
            if (res?.ok) {
                try {
                    const ev = new CustomEvent('overlayComponentsChanged')
                    window.dispatchEvent(ev)
                } catch { }
                try {
                    const ev2 = new CustomEvent('overlay:refresh')
                    window.dispatchEvent(ev2)
                } catch {}
            }
        } catch { }
    }

    return (
        <button
            title="Custom Text"
            className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[115px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2"
            onClick={onCreate}
            disabled={disabled}
        >
            <MdOutlineTextFields className="h-4.5 w-4.5 text-slate-400" />
            <span className="text-slate-400">Custom Text</span>
        </button>
    )
}