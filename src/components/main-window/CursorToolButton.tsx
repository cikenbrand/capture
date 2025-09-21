import { FaMousePointer } from 'react-icons/fa'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

export default function CursorToolButton() {
    const [selectedTool, setSelectedTool] = useState<null | 'select' | 'arrow' | 'circle' | 'free' | 'rect' | 'eraser'>(null)
    const isActive = selectedTool === 'select'

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedDrawingTool')
                if (!cancelled && res?.ok) setSelectedTool(res.data ?? null)
            } catch {}
        })()
        const onChanged = (e: any) => {
            try { setSelectedTool((e?.detail ?? null) || null) } catch {}
        }
        window.addEventListener('selectedDrawingToolChanged', onChanged as any)
        return () => window.removeEventListener('selectedDrawingToolChanged', onChanged as any)
    }, [])
    return (
        <button
            onClick={async () => {
                const next = selectedTool === 'select' ? null : 'select'
                try {
                    await window.ipcRenderer.invoke('app:setSelectedDrawingTool', next)
                    setSelectedTool(next)
                    window.dispatchEvent(new CustomEvent('selectedDrawingToolChanged', { detail: next }))
                    if (next) {
                        // Ensure overlay is enabled so selection works even when coming from disabled state
                        window.dispatchEvent(new CustomEvent('app:toggle-draw-overlay', { detail: { enabled: true } }))
                        window.dispatchEvent(new CustomEvent('app:set-draw-tool', { detail: { tool: 'select' } }))
                    } else {
                        // default: disable overlay and set tool to select (no drawing)
                        window.dispatchEvent(new CustomEvent('app:toggle-draw-overlay', { detail: { enabled: false } }))
                        window.dispatchEvent(new CustomEvent('app:set-draw-tool', { detail: { tool: 'select' } }))
                    }
                } catch { }
            }}
            data-draw-ui='true'
            title="Move Tool"
            className={clsx(
                "flex items-center justify-center h-[28px] aspect-square rounded-[2px] disabled:opacity-50 disabled:pointer-events-none",
                isActive
                    ? "bg-[#202832] text-[#71BCFC]"
                    : "text-white hover:bg-[#4C525E] active:bg-[#202832] active:text-[#71BCFC]"
            )}
        >
            <FaMousePointer className="h-3.5 w-3.5" />
        </button>
    )
}