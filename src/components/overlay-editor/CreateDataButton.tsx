import { useEffect, useState } from "react";
import { LuCable } from "react-icons/lu";

export default function CreateDataButton() {
    const [overlayId, setOverlayId] = useState<string | null>(null)
    const disabled = !overlayId

    useEffect(() => {
        let done = false
        ;(async () => {
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
        return () => {
            done = true
            window.removeEventListener('selectedOverlayLayerChanged', onSelectedOverlayChanged as any)
        }
    }, [])

    async function onCreate() {
        if (!overlayId) return
        try {
            const res = await window.ipcRenderer.invoke('db:createOverlayComponent', {
                overlayId,
                type: 'data',
            })
            if (res?.ok) {
                try {
                    const ev = new CustomEvent('overlayComponentsChanged', { detail: { action: 'created', type: 'data' } })
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
            title="Data"
            className="rounded-[7px] bg-[#1D2229] border border-2 border-white/10 flex items-center justify-center h-[28px] px-2 gap-2 rounded-[2px] text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
            onClick={onCreate}
            disabled={disabled}
        >
            <LuCable className="h-4 w-4" />
            <span className="font-medium">Data</span>
        </button>
    )
}
