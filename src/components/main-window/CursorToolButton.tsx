import { FaMousePointer } from 'react-icons/fa'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

export default function CursorToolButton() {
    const [selectedTool, setSelectedTool] = useState<null | 'select' | 'arrow' | 'circle' | 'free' | 'rect' | 'eraser'>(null)
    const [isMultiView, setIsMultiView] = useState(false)
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
        const onMultiView = (e: any) => {
            try { setIsMultiView(!!e?.detail) } catch {}
        }
        window.addEventListener('selectedDrawingToolChanged', onChanged as any)
        window.addEventListener('app:multiview-changed', onMultiView as any)
        return () => {
            window.removeEventListener('selectedDrawingToolChanged', onChanged as any)
            window.removeEventListener('app:multiview-changed', onMultiView as any)
        }
    }, [])

    useEffect(() => {
        const onDocMouseDown = async (e: any) => {
            try {
                if (!isActive) return
                const el = (e?.target ?? null) as HTMLElement | null
                const insideDrawUi = !!el?.closest?.('[data-draw-ui="true"]')
                const insideSurface = !!el?.closest?.('[data-draw-surface="true"]')
                if (insideDrawUi || insideSurface) return
                await window.ipcRenderer.invoke('app:setSelectedDrawingTool', null)
                setSelectedTool(null)
                window.dispatchEvent(new CustomEvent('selectedDrawingToolChanged', { detail: null }))
                window.dispatchEvent(new CustomEvent('app:toggle-draw-overlay', { detail: { enabled: false } }))
                window.dispatchEvent(new CustomEvent('app:set-draw-tool', { detail: { tool: 'select' } }))
            } catch {}
        }
        window.addEventListener('mousedown', onDocMouseDown as any)
        return () => window.removeEventListener('mousedown', onDocMouseDown as any)
    }, [isActive])
    return (
        <button
            disabled={isMultiView}
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
            title="Select & Move Drawing Tool"
            className={clsx(
                "flex items-center justify-center h-[28px] px-2 gap-2 rounded-[2px] disabled:opacity-50 disabled:pointer-events-none",
                isActive
                    ? "bg-[#202832] text-[#71BCFC]"
                    : "text-white hover:bg-[#4C525E] active:bg-[#202832] active:text-[#71BCFC]"
            )}
        >
            <FaMousePointer className="h-3.5 w-3.5" />
            <span className='font-medium'>Select & Move Drawing</span>
        </button>
    )
}