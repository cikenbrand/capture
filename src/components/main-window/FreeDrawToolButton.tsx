import { FaPencilAlt } from 'react-icons/fa'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

export default function FreeDrawToolButton() {
  const [selectedTool, setSelectedTool] = useState<null | 'select' | 'arrow' | 'circle' | 'free' | 'rect' | 'eraser'>(null)
  const isActive = selectedTool === 'free'

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
        const next = selectedTool === 'free' ? null : 'free'
        try {
          await window.ipcRenderer.invoke('app:setSelectedDrawingTool', next)
          setSelectedTool(next)
          window.dispatchEvent(new CustomEvent('selectedDrawingToolChanged', { detail: next }))
          if (next) {
            window.dispatchEvent(new CustomEvent('app:toggle-draw-overlay', { detail: { enabled: true } }));
            window.dispatchEvent(new CustomEvent('app:set-draw-tool', { detail: { tool: next } }));
          } else {
            window.dispatchEvent(new CustomEvent('app:toggle-draw-overlay', { detail: { enabled: false } }));
            window.dispatchEvent(new CustomEvent('app:set-draw-tool', { detail: { tool: 'select' } }));
          }
        } catch { }
      }}
      data-draw-ui='true'
      title="Free Draw"
      className={clsx(
        "flex items-center justify-center h-[28px] aspect-square rounded-[2px] disabled:opacity-50 disabled:pointer-events-none",
        isActive
          ? "bg-[#202832] text-[#71BCFC]"
          : "text-white hover:bg-[#4C525E] active:bg-[#202832] active:text-[#71BCFC]"
      )}
    >
      <FaPencilAlt className="h-3.5 w-3.5" />
    </button>
  )
}