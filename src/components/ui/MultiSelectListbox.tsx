import * as React from "react"
import { cn } from "@/lib/utils"

export type MultiListboxItem = {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

type MultiSelectListboxProps = {
  items: MultiListboxItem[]
  selectedValues?: string[]
  onChange?: (values: string[]) => void
  className?: string
  itemClassName?: string
  maxHeightPx?: number
}

export function MultiSelectListbox({ items, selectedValues = [], onChange, className, itemClassName, maxHeightPx }: MultiSelectListboxProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const enabledItems = React.useMemo(() => items.filter(i => !i.disabled), [items])
  const lastIndex = React.useMemo(() => {
    if (!selectedValues.length) return -1
    return enabledItems.findIndex(i => i.value === selectedValues[selectedValues.length - 1])
  }, [enabledItems, selectedValues])
  const [activeIndex, setActiveIndex] = React.useState<number>(Math.max(0, lastIndex))

  React.useEffect(() => {
    if (lastIndex >= 0) setActiveIndex(lastIndex)
  }, [lastIndex])

  function moveActive(delta: number) {
    if (!enabledItems.length) return
    setActiveIndex(idx => {
      const next = Math.min(enabledItems.length - 1, Math.max(0, idx + delta))
      return next
    })
  }

  function selectActive(e?: { ctrlKey?: boolean; metaKey?: boolean }) {
    const item = enabledItems[activeIndex]
    if (!item || item.disabled) return
    const current = new Set(selectedValues)
    if (e?.ctrlKey || e?.metaKey) {
      if (current.has(item.value)) current.delete(item.value); else current.add(item.value)
    } else {
      current.clear(); current.add(item.value)
    }
    onChange?.(Array.from(current))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1) }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1) }
    else if (e.key === "Home") { e.preventDefault(); setActiveIndex(0) }
    else if (e.key === "End") { e.preventDefault(); setActiveIndex(Math.max(0, enabledItems.length - 1)) }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectActive(e) }
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
      aria-multiselectable
      aria-activedescendant={activeIndex >= 0 ? `lb-item-${activeIndex}` : undefined}
      className={cn(
        "bg-[#21262E] p-1 relative z-0 w-full overflow-auto outline-none h-full",
        "focus-visible:ring-blue-300 focus-visible:ring-[1px]",
        className
      )}
      style={typeof maxHeightPx === 'number' ? { maxHeight: maxHeightPx } : undefined}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setActiveIndex(-1)}
    >
      {items.map((item, i) => {
        const isSelected = (selectedValues ?? []).includes(item.value)
        const isActive = enabledItems[activeIndex]?.value === item.value
        const disabled = !!item.disabled
        const isMulti = (selectedValues ?? []).length > 1
        return (
          <div
            key={item.value}
            id={`lb-item-${i}`}
            data-index={enabledItems.findIndex(e => e.value === item.value)}
            role="option"
            aria-selected={isSelected}
            aria-disabled={disabled}
            className={cn(
              "relative flex w-full cursor-default items-center gap-2 py-1 pr-8 pl-2 text-sm select-none rounded-[3px] border border-transparent text-slate-400",
              !isSelected && "hover:bg-[#2A3644] hover:border-transparent",
              // When multiple are selected, use the selected color for the active row too
              isMulti && isActive && !isSelected && "bg-[#374F66] text-slate-400",
              !isMulti && isActive && !isSelected && "bg-[#2A3644] text-slate-400",
              isSelected && "bg-[#374F66] text-slate-400",
              disabled && "opacity-50 pointer-events-none",
              itemClassName
            )}
            onMouseEnter={() => {
              if (disabled) return
              const idx = enabledItems.findIndex(e => e.value === item.value)
              if (idx >= 0) setActiveIndex(idx)
            }}
            onClick={(e) => {
              if (disabled) return
              const current = new Set(selectedValues ?? [])
              if (e.ctrlKey || e.metaKey) {
                if (current.has(item.value)) current.delete(item.value); else current.add(item.value)
              } else {
                current.clear(); current.add(item.value)
              }
              onChange?.(Array.from(current))
            }}
          >
            <span className="truncate">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}


