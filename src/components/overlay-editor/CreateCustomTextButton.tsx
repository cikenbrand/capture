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
            className="rounded-[7px] bg-[#1D2229] border border-2 border-white/10 flex items-center justify-center h-[28px] px-2 gap-2 rounded-[2px] text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
            onClick={onCreate}
            disabled={disabled}
        >
            <MdOutlineTextFields className="h-4.5 w-4.5" />
            <span className="font-medium">Custom Text</span>
        </button>
    )
}