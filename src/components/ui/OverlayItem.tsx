import { PropsWithChildren, useMemo } from "react";
import { motion } from "motion/react";
import { STAGE_HEIGHT, STAGE_WIDTH, useOverlayContext } from "./OverlayEditorCanvas";

export type OverlayItemProps = PropsWithChildren<{
  id: string;
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  onChange: (next: { x?: number; y?: number; width?: number; height?: number }) => void;
  showIndicator?: boolean;
  onItemDoubleClick?: (id: string) => void;
}>;

type Handle =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function OverlayItem(props: OverlayItemProps) {
  const { scale, activeId, setActiveId, selectedIds, setSelectedIds, reportBounds, unregisterBounds, registerUpdater, unregisterUpdater, emitUpdate, getBounds, notifyMoved, computeSnappedDelta, computeSnappedResize, updateGuides } = useOverlayContext();
  const isActive = activeId === props.id || selectedIds.has(props.id);
  const minSize = 24;

  // Keep bounds up to date for marquee hit-testing
  useMemo(() => {
    reportBounds(props.id, { x: props.x, y: props.y, width: props.width, height: props.height });
    return () => unregisterBounds(props.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.id, props.x, props.y, props.width, props.height]);

  // Register this item's updater so canvas can move groups
  useMemo(() => {
    registerUpdater(props.id, props.onChange);
    return () => unregisterUpdater(props.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.id, props.onChange]);

  function startDragMove(e: React.PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActiveId(props.id);
    // Update selection based on modifier keys
    const next = new Set(selectedIds);
    if (e.ctrlKey || e.metaKey) {
      if (next.has(props.id)) next.delete(props.id); else next.add(props.id);
    } else if (e.shiftKey) {
      next.add(props.id);
    } else {
      next.clear();
      next.add(props.id);
    }
    setSelectedIds(next);
    const initialSelection = new Set(next);
    const startX = e.clientX;
    const startY = e.clientY;
    // Snapshot selected items' start positions and compute group movement limits
    const selectedStarts = new Map<string, { x: number; y: number; w: number; h: number }>();
    initialSelection.forEach((id) => {
      const b = getBounds(id);
      if (b) selectedStarts.set(id, { x: b.x, y: b.y, w: b.width, h: b.height });
    });
    let groupDxMin = -Infinity;
    let groupDxMax = Infinity;
    let groupDyMin = -Infinity;
    let groupDyMax = Infinity;
    selectedStarts.forEach((s) => {
      // Each item allows dx in [ -s.x, STAGE_WIDTH - s.w - s.x ]
      const minDx = -s.x;
      const maxDx = STAGE_WIDTH - s.w - s.x;
      const minDy = -s.y;
      const maxDy = STAGE_HEIGHT - s.h - s.y;
      groupDxMin = Math.max(groupDxMin, minDx);
      groupDxMax = Math.min(groupDxMax, maxDx);
      groupDyMin = Math.max(groupDyMin, minDy);
      groupDyMax = Math.min(groupDyMax, maxDy);
    });
    function onMove(ev: PointerEvent) {
      let dx = (ev.clientX - startX) / scale;
      let dy = (ev.clientY - startY) / scale;
      // Clamp group delta so that no item crosses bounds
      dx = clamp(dx, groupDxMin, groupDxMax);
      dy = clamp(dy, groupDyMin, groupDyMax);
      const startsArr = Array.from(selectedStarts.entries()).map(([id, s]) => ({ id, x: s.x, y: s.y, w: s.w, h: s.h }));
      const snapped = computeSnappedDelta({ starts: startsArr, dx, dy });
      updateGuides(snapped.guides);
      selectedStarts.forEach((s, id) => {
        const targetX = s.x + snapped.dx;
        const targetY = s.y + snapped.dy;
        emitUpdate(id, { x: targetX, y: targetY });
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      updateGuides([]);
      notifyMoved(initialSelection.size > 1 ? initialSelection : new Set([props.id]));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResize(e: React.PointerEvent, handle: Handle) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActiveId(props.id);
    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const start = { x: props.x, y: props.y, width: props.width, height: props.height };
    const centerX = start.x + start.width / 2;
    const centerY = start.y + start.height / 2;
    const maxWidthByCenter = 2 * Math.min(centerX, STAGE_WIDTH - centerX);
    const maxHeightByCenter = 2 * Math.min(centerY, STAGE_HEIGHT - centerY);

    let raf = 0;
    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startPointerX) / scale;
      const dy = (ev.clientY - startPointerY) / scale;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const signedDx = handle.includes("right") ? dx : handle.includes("left") ? -dx : 0;
        const signedDy = handle.includes("bottom") ? dy : handle.includes("top") ? -dy : 0;
        const isCorner = handle.includes("-");

        // Compute a proposed rect without snapping first
        let proposed: { x: number; y: number; width: number; height: number };
        if (isCorner) {
          const sX = (start.width + 2 * signedDx) / start.width;
          const sY = (start.height + 2 * signedDy) / start.height;
          const sPick = Math.abs(sX - 1) > Math.abs(sY - 1) ? sX : sY;
          const sMin = minSize / start.width;
          const sMax = Math.min(maxWidthByCenter / start.width, maxHeightByCenter / start.height);
          const s = Math.min(Math.max(sPick, sMin), sMax);
          const w = clamp(start.width * s, minSize, STAGE_WIDTH);
          const h = clamp(start.height * s, minSize, STAGE_HEIGHT);
          const newX = centerX - w / 2;
          const newY = centerY - h / 2;
          proposed = { x: newX, y: newY, width: w, height: h };
        } else if (handle === "right") {
          const maxW = STAGE_WIDTH - start.x;
          const w = clamp(start.width + dx, minSize, maxW);
          proposed = { x: start.x, y: start.y, width: w, height: start.height };
        } else if (handle === "left") {
          const newX = clamp(start.x + dx, 0, start.x + start.width - minSize);
          const w = start.width - (newX - start.x);
          proposed = { x: newX, y: start.y, width: w, height: start.height };
        } else if (handle === "bottom") {
          const maxH = STAGE_HEIGHT - start.y;
          const h = clamp(start.height + dy, minSize, maxH);
          proposed = { x: start.x, y: start.y, width: start.width, height: h };
        } else {
          const newY = clamp(start.y + dy, 0, start.y + start.height - minSize);
          const h = start.height - (newY - start.y);
          proposed = { x: start.x, y: newY, width: start.width, height: h };
        }

        // Ask canvas to snap proposed rect to neighbors
        const snapped = computeSnappedResize({ id: props.id, handle, proposed, minSize });
        updateGuides(snapped.guides);
        props.onChange(snapped.rect);
      });
    }
    function onUp() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Notify move/resize end
      updateGuides([]);
      notifyMoved(new Set([props.id]));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <>
      <motion.div
        className={`absolute select-none bg-transparent`}
        style={{ x: props.x, y: props.y, width: props.width, height: props.height,
          zIndex: props.zIndex ?? 0,
        }}
        transition={{ duration: 0 }}
        onPointerDown={startDragMove}
        onDoubleClick={() => { setActiveId(props.id); props.onItemDoubleClick?.(props.id); }}
        data-overlay-item-id={props.id}
        data-overlay-item-type={props.type}
      >
        {props.children}
        {isActive && props.showIndicator !== false && (
          <div className="absolute left-1/2 -bottom-7 -translate-x-1/2 whitespace-nowrap text-xs font-medium px-2 py-1 rounded bg-black/70 text-white border border-white/10">
            x: {Math.round(props.x)} y: {Math.round(props.y)} w: {Math.round(props.width)} h: {Math.round(props.height)}
          </div>
        )}
      </motion.div>

      {isActive && selectedIds.size <= 1 && (
        <div
          className="absolute pointer-events-none"
          style={{ transform: `translate(${props.x}px, ${props.y}px)`, width: props.width, height: props.height, zIndex: 10 }}
        >
          <div className="absolute inset-0 border border-sky-400/90 rounded-md" />
          {/* Edge handles */}
          <div onPointerDown={(e) => startResize(e, "left")} className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-sky-400 pointer-events-auto cursor-ew-resize shadow" />
          <div onPointerDown={(e) => startResize(e, "right")} className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-sky-400 pointer-events-auto cursor-ew-resize shadow" />
          <div onPointerDown={(e) => startResize(e, "top")} className="absolute top-0 left-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded bg-sky-400 pointer-events-auto cursor-ns-resize shadow" />
          <div onPointerDown={(e) => startResize(e, "bottom")} className="absolute bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded bg-sky-400 pointer-events-auto cursor-ns-resize shadow" />
          {/* Corners */}
          <div onPointerDown={(e) => startResize(e, "top-left")} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-sky-400 pointer-events-auto cursor-nwse-resize shadow" />
          <div onPointerDown={(e) => startResize(e, "top-right")} className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-sky-400 pointer-events-auto cursor-nesw-resize shadow" />
          <div onPointerDown={(e) => startResize(e, "bottom-left")} className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded bg-sky-400 pointer-events-auto cursor-nesw-resize shadow" />
          <div onPointerDown={(e) => startResize(e, "bottom-right")} className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 rounded bg-sky-400 pointer-events-auto cursor-nwse-resize shadow" />
        </div>
      )}
    </>
  );
}


