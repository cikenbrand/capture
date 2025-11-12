import * as React from "react"
import { cn } from "@/lib/utils"

export type ListboxItem = {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

type ListboxProps = {
  items: readonly ListboxItem[]
  selectedValue?: string | null
  onChange?: (value: string) => void
  className?: string
  itemClassName?: string
  /** Optional max height of the list before it scrolls (e.g., 240) */
  maxHeightPx?: number
}

export function Listbox({
  items,
  selectedValue = null,
  onChange,
  className,
  itemClassName,
  maxHeightPx,
}: ListboxProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const enabledItems = React.useMemo(() => items.filter(i => !i.disabled), [items])
  const selectedIndex = React.useMemo(
    () => (selectedValue == null ? -1 : enabledItems.findIndex(i => i.value === selectedValue)),
    [enabledItems, selectedValue]
  )
  const [activeIndex, setActiveIndex] = React.useState<number>(Math.max(0, selectedIndex))

  React.useEffect(() => {
    if (selectedIndex >= 0) setActiveIndex(selectedIndex)
  }, [selectedIndex])

  const handleMouseLeave = React.useCallback(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : -1)
  }, [selectedIndex])

  function moveActive(delta: number) {
    if (!enabledItems.length) return
    setActiveIndex(idx => {
      const next = Math.min(enabledItems.length - 1, Math.max(0, idx + delta))
      return next
    })
  }

  function selectActive() {
    const item = enabledItems[activeIndex]
    if (!item || item.disabled) return
    onChange?.(item.value)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveIndex(Math.max(0, enabledItems.length - 1))
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      selectActive()
    }
  }

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const active = node.querySelector<HTMLDivElement>(`[data-index="${activeIndex}"]`)
    if (active) {
      const activeTop = active.offsetTop
      const activeBottom = activeTop + active.offsetHeight
      const viewTop = node.scrollTop
      const viewBottom = viewTop + node.clientHeight
      if (activeTop < viewTop) node.scrollTop = activeTop
      else if (activeBottom > viewBottom) node.scrollTop = activeBottom - node.clientHeight
    }
  }, [activeIndex])

  return (
    <div
      ref={containerRef}
      role="listbox"
      tabIndex={0}
      aria-multiselectable={undefined}
      aria-activedescendant={activeIndex >= 0 ? `lb-item-${activeIndex}` : undefined}
      className={cn(
        "bg-black/5 border border-white/10 p-2 relative z-0 w-full overflow-auto outline-none h-full",
        "focus-visible:ring-blue-300 focus-visible:ring-[1px]",
        className
      )}
      style={typeof maxHeightPx === 'number' ? { maxHeight: maxHeightPx } : undefined}
      onKeyDown={onKeyDown}
      onMouseLeave={handleMouseLeave}
    >
      {items.map((item, i) => {
        const isSelected = selectedValue != null && item.value === selectedValue
        const isActive = enabledItems[activeIndex]?.value === item.value
        const disabled = !!item.disabled
        return (
          <div
            key={item.value}
            id={`lb-item-${i}`}
            data-index={enabledItems.findIndex(e => e.value === item.value)}
            role="option"
            aria-selected={isSelected}
            aria-disabled={disabled}
            className={cn(
              "relative flex w-full cursor-pointer items-center gap-2 py-1 pr-8 pl-2 select-none rounded border border-transparent text-slate-400",
              !isSelected && "hover:bg-[#2A3644]",
              isActive && !isSelected && "bg-[#2A3644] text-slate-400",
              isSelected && "bg-[#374F66] text-slate-400",
              disabled && "opacity-50 pointer-events-none",
              itemClassName
            )}
            onMouseEnter={() => {
              if (disabled) return
              const idx = enabledItems.findIndex(e => e.value === item.value)
              if (idx >= 0) setActiveIndex(idx)
            }}
            onMouseDown={(e) => {
              if (disabled) return
              // Prevent focus loss flicker and ensure consistent firing
              try { e.preventDefault() } catch {}
              onChange?.(item.value)
            }}
          >
            <span className="truncate">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}



