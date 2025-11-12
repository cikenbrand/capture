import * as React from "react"
import { ItemInstance } from "@headless-tree/core"
import { ChevronDownIcon } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

interface TreeContextValue<T = any> {
  indent: number
  currentItem?: ItemInstance<T>
  tree?: any
  hoveredItemId?: string
  setHoveredItemId?: (id: string | undefined) => void
}

const TreeContext = React.createContext<TreeContextValue>({
  indent: 20,
  currentItem: undefined,
  tree: undefined,
  hoveredItemId: undefined,
  setHoveredItemId: undefined,
})

function useTreeContext<T = any>() {
  return React.useContext(TreeContext) as TreeContextValue<T>
}

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  indent?: number
  tree?: any
}

function Tree({ indent = 20, tree, className, ...props }: TreeProps) {
  const [hoveredItemId, setHoveredItemId] = React.useState<string | undefined>(
    undefined
  )
  const containerProps =
    tree && typeof tree.getContainerProps === "function"
      ? tree.getContainerProps()
      : {}
  const mergedProps = { ...props, ...containerProps }

  // Extract style from mergedProps to merge with our custom styles
  const { style: propStyle, ...otherProps } = mergedProps

  // Merge styles
  const mergedStyle = {
    ...propStyle,
    "--tree-indent": `${indent}px`,
  } as React.CSSProperties

  return (
    <TreeContext.Provider
      value={{ indent, tree, hoveredItemId, setHoveredItemId }}
    >
      <div
        data-slot="tree"
        style={mergedStyle}
        className={cn("flex flex-col", className)}
        {...otherProps}
      />
    </TreeContext.Provider>
  )
}

interface TreeItemProps<T = any>
  extends React.HTMLAttributes<HTMLButtonElement> {
  item: ItemInstance<T>
  indent?: number
  asChild?: boolean
}

function TreeItem<T = any>({
  item,
  className,
  asChild,
  children,
  ...props
}: Omit<TreeItemProps<T>, "indent">) {
  const ctx = useTreeContext<T>()
  const indent = ctx.indent

  const itemProps = typeof item.getProps === "function" ? item.getProps() : {}
  const mergedProps = { ...props, ...itemProps }

  // Extract style from mergedProps to merge with our custom styles
  const { style: propStyle, ...otherProps } = mergedProps

  // Merge styles
  const mergedStyle = {
    ...propStyle,
    "--tree-padding": `${item.getItemMeta().level * indent}px`,
  } as React.CSSProperties

  const Comp = asChild ? Slot.Root : "button"

  return (
    <TreeContext.Provider
      value={{ ...ctx, currentItem: item }}
    >
      <Comp
        data-slot="tree-item"
        style={mergedStyle}
        className={cn(
          "hover:bg-slate-700/50 data-[selected=true]:bg-slate-700/50 z-10 ps-(--tree-padding) outline-hidden select-none not-last:pb-0.5 focus:z-20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full block text-left",
          className
        )}
        onMouseEnter={(e: any) => {
          try {
            ;(otherProps as any)?.onMouseEnter?.(e)
          } catch {}
          try {
            ctx.setHoveredItemId?.(typeof (item as any).getId === "function" ? (item as any).getId() : undefined)
          } catch {
            ctx.setHoveredItemId?.(undefined)
          }
        }}
        onMouseLeave={(e: any) => {
          try {
            ;(otherProps as any)?.onMouseLeave?.(e)
          } catch {}
          try {
            ctx.setHoveredItemId?.(undefined)
          } catch {}
        }}
        data-focus={
          typeof item.isFocused === "function"
            ? item.isFocused() || false
            : undefined
        }
        data-folder={
          typeof item.isFolder === "function"
            ? item.isFolder() || false
            : undefined
        }
        data-selected={
          typeof item.isSelected === "function"
            ? item.isSelected() || false
            : undefined
        }
        data-drag-target={
          typeof item.isDragTarget === "function"
            ? item.isDragTarget() || false
            : undefined
        }
        data-search-match={
          typeof item.isMatchingSearch === "function"
            ? item.isMatchingSearch() || false
            : undefined
        }
        aria-expanded={item.isExpanded()}
        {...otherProps}
      >
        {children}
      </Comp>
    </TreeContext.Provider>
  )
}

interface TreeItemLabelProps<T = any>
  extends React.HTMLAttributes<HTMLSpanElement> {
  item?: ItemInstance<T>
}

function TreeItemLabel<T = any>({
  item: propItem,
  children,
  className,
  ...props
}: TreeItemLabelProps<T>) {
  const { currentItem, hoveredItemId } = useTreeContext<T>()
  const item = propItem || currentItem

  if (!item) {
    console.warn("TreeItemLabel: No item provided via props or context")
    return null
  }

  return (
    <span
      data-slot="tree-item-label"
      className={cn(
        "in-focus-visible:ring-ring/50 bg-[#161A22] not-in-data-[selected=true]:hover:bg-[#242E3D] in-data-[selected=true]:bg-[#242E3D] in-data-[selected=false]:text-slate-400 in-data-[selected=true]:text-white/80 in-data-[drag-target=true]:bg-transparent flex items-center gap-1 rounded px-2 py-0.5 not-in-data-[folder=true]:ps-7 in-focus-visible:ring-[3px] in-data-[search-match=true]:bg-transparent w-full min-w-0",
        // Apply hovered background when the parent tree item is hovered and not selected
        (() => {
          try {
            const id =
              typeof (item as any).getId === "function"
                ? (item as any).getId()
                : undefined
            const selected =
              typeof (item as any).isSelected === "function"
                ? (item as any).isSelected() || false
                : false
            return hoveredItemId && id && hoveredItemId === id && !selected
              ? "bg-[#242E3D]"
              : ""
          } catch {
            return ""
          }
        })(),
        className
      )}
      {...props}
    >
      {item.isFolder() && (
        <ChevronDownIcon className="text-muted-foreground size-4 in-aria-[expanded=false]:-rotate-90" />
      )}
      {children ||
        (typeof item.getItemName === "function" ? item.getItemName() : null)}
    </span>
  )
}

function TreeDragLine({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { tree } = useTreeContext()

  if (!tree || typeof tree.getDragLineStyle !== "function") {
    console.warn(
      "TreeDragLine: No tree provided via context or tree does not have getDragLineStyle method"
    )
    return null
  }

  const dragLine = tree.getDragLineStyle()
  return (
    <div
      style={dragLine}
      className={cn(
        "bg-primary before:bg-background before:border-primary absolute z-30 -mt-px h-0.5 w-[unset] before:absolute before:-top-[3px] before:left-0 before:size-2 before:rounded-full before:border-2",
        className
      )}
      {...props}
    />
  )
}

export { Tree, TreeItem, TreeItemLabel, TreeDragLine }
