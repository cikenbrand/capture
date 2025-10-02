import { useEffect, useState } from "react";
import { IoCalendar } from "react-icons/io5";

export default function CreateDateButton() {
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
                type: 'date',
            })
            if (res?.ok) {
                try {
                    const ev = new CustomEvent('overlayComponentsChanged', { detail: { action: 'created', type: 'date' } })
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
            title="Date"
            className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none"
            onClick={onCreate}
            disabled={disabled}
        >
            <IoCalendar className="h-4.5 w-4.5" />
        </button>
    )
}
