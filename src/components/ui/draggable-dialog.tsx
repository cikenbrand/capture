import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export type DraggableDialogProps = {
  open: boolean
  onOpenChange: (next: boolean) => void
  title?: string
  width?: number
  /** Tailwind padding classes for content area, e.g. "p-4", "px-6 py-3". Defaults to "p-4". */
  contentPadding?: string
  /** When true, clicking outside or pressing Escape will not close the dialog, and the close button is hidden. */
  disableBackdropClose?: boolean
  /** When true, show a dimmed backdrop; when false, keep backdrop transparent. Defaults to true. */
  useBackdrop?: boolean
  children?: React.ReactNode
}

export function DraggableDialog({ open, onOpenChange, title, width = 520, contentPadding = "p-4", disableBackdropClose = false, useBackdrop = true, children }: DraggableDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const dragInfoRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const el = panelRef.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    const rect = el?.getBoundingClientRect()
    const w = rect?.width ?? width
    const h = rect?.height ?? 260
    setPos({ left: Math.max(16, Math.round(vw / 2 - w / 2)), top: Math.max(16, Math.round(vh / 2 - h / 2)) })
  }, [open, width])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableBackdropClose) onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange, disableBackdropClose])

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const { left, top } = pos
    dragInfoRef.current = { startX, startY, startLeft: left, startTop: top }
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      const el = panelRef.current
      const rect = el?.getBoundingClientRect()
      const w = rect?.width ?? 0
      const h = rect?.height ?? 0
      const vw = window.innerWidth
      const vh = window.innerHeight
      const nextLeft = Math.min(Math.max(8, left + dx), Math.max(8, vw - w - 8))
      const nextTop = Math.min(Math.max(8, top + dy), Math.max(8, vh - h - 8))
      setPos({ left: nextLeft, top: nextTop })
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      dragInfoRef.current = null
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[50]">
      <div className={`absolute inset-0 ${useBackdrop ? 'bg-black/70' : ''} z-[7000]`} onClick={disableBackdropClose ? undefined : () => onOpenChange(false)} />
      <div
        ref={panelRef}
        className="absolute w-[520px] max-w-[calc(100%-2rem)] border border-slate-700 bg-[#21262E] shadow-lg z-[7001] rounded overflow-hidden"
        style={{ left: pos.left, top: pos.top, width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="h-8 flex items-center px-3 bg-[#1A1E25] border-b border-slate-700 relative justify-center"
          onMouseDown={onHeaderMouseDown}
        >
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-slate-400">{title}</div>
          {!disableBackdropClose ? (
            <button className="absolute right-3 text-white/60 hover:text-white" onClick={() => onOpenChange(false)}>✕</button>
          ) : null}
        </div>
        <div className={`${contentPadding} bg-[#1A1E25]`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}


