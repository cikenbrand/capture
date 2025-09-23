import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";

export type OverlayContextValue = {
  scale: number;
  stageWidth: number;
  stageHeight: number;
  // Expose stage ref so consumers (e.g., context menu) can bind events to the canvas only
  stageRef: React.RefObject<HTMLDivElement | null>;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  reportBounds: (
    id: string,
    bounds: { x: number; y: number; width: number; height: number; keepSquare?: boolean }
  ) => void;
  unregisterBounds: (id: string) => void;
  getBounds: (id: string) => { x: number; y: number; width: number; height: number } | undefined;
  registerUpdater: (id: string, fn: (next: { x?: number; y?: number; width?: number; height?: number }) => void) => void;
  unregisterUpdater: (id: string) => void;
  emitUpdate: (id: string, next: { x?: number; y?: number; width?: number; height?: number }) => void;
  notifyMoved: (ids: Set<string>) => void;
  // Compute snapped delta for moving one or more items; also returns guides to visualize
  computeSnappedDelta: (args: {
    starts: { id: string; x: number; y: number; w: number; h: number }[];
    dx: number;
    dy: number;
  }) => { dx: number; dy: number; guides: Guide[] };
  // Compute snapped rectangle while resizing a single item against others/stage
  computeSnappedResize: (args: {
    id: string;
    handle: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    proposed: { x: number; y: number; width: number; height: number };
    minSize?: number;
  }) => { rect: { x: number; y: number; width: number; height: number }; guides: Guide[] };
  updateGuides: (guides: Guide[]) => void;
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlayContext(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlayContext must be used within OverlayEditorCanvas");
  return ctx;
}

// Optional variant that does not throw; returns null when not inside the canvas provider
export function useOverlayContextOptional(): OverlayContextValue | null {
  return useContext(OverlayContext);
}

function useResizeObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ width: cr.width, height: cr.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, size } as const;
}

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

// Visual guide primitives
export type Guide =
  | { kind: "v-line"; x: number }
  | { kind: "h-line"; y: number }
  | { kind: "h-gap"; fromX: number; toX: number; y: number; label: string }
  | { kind: "v-gap"; fromY: number; toY: number; x: number; label: string };

type OverlayEditorCanvasProps = PropsWithChildren<{
  onItemsMoved?: (positions: { id: string; x: number; y: number; width: number; height: number }[]) => void;
  selectedItemIdsFromOutside?: string[] | null;
  onSelectionChange?: (ids: string[]) => void;
  snapEnabled?: boolean;
  showGuides?: boolean;
}>;

export default function OverlayEditorCanvas({ children, onItemsMoved, selectedItemIdsFromOutside, onSelectionChange, snapEnabled = true, showGuides = true }: OverlayEditorCanvasProps) {
  const { ref: viewportRef, size: viewport } = useResizeObserver<HTMLDivElement>();
  const [zoomFactor, setZoomFactor] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const itemBoundsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const itemUpdaterRef = useRef<Map<string, (next: { x?: number; y?: number; width?: number; height?: number }) => void>>(new Map());
  const [marquee, setMarquee] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  const baseScale = useMemo(() => {
    if (!viewport.width || !viewport.height) return 1;
    return Math.min(viewport.width / STAGE_WIDTH, viewport.height / STAGE_HEIGHT);
  }, [viewport.width, viewport.height]);

  const scale = useMemo(() => baseScale * zoomFactor, [baseScale, zoomFactor]);

  const offset = useMemo(() => {
    const displayW = STAGE_WIDTH * scale;
    const displayH = STAGE_HEIGHT * scale;
    return {
      left: (viewport.width - displayW) / 2 + pan.x,
      top: (viewport.height - displayH) / 2 + pan.y,
    };
  }, [scale, viewport.width, viewport.height, pan.x, pan.y]);

  const ctxValue = useMemo<OverlayContextValue>(
    () => ({
      scale,
      stageWidth: STAGE_WIDTH,
      stageHeight: STAGE_HEIGHT,
      stageRef,
      activeId,
      setActiveId,
      selectedIds,
      setSelectedIds: (ids: Set<string>) => setSelectedIds(new Set(ids)),
      reportBounds: (id, b) => {
        itemBoundsRef.current.set(id, b);
      },
      unregisterBounds: (id) => {
        itemBoundsRef.current.delete(id);
      },
      getBounds: (id) => itemBoundsRef.current.get(id),
      registerUpdater: (id, fn) => {
        itemUpdaterRef.current.set(id, fn);
      },
      unregisterUpdater: (id) => {
        itemUpdaterRef.current.delete(id);
      },
      emitUpdate: (id, next) => {
        const fn = itemUpdaterRef.current.get(id);
        if (fn) fn(next);
      },
      notifyMoved: (ids: Set<string>) => {
        if (!onItemsMoved) return;
        const positions: { id: string; x: number; y: number; width: number; height: number }[] = [];
        ids.forEach((id) => {
          const b = itemBoundsRef.current.get(id);
          if (b) positions.push({ id, x: b.x, y: b.y, width: b.width, height: b.height });
        });
        if (positions.length) onItemsMoved(positions);
      },
      computeSnappedDelta: ({ starts, dx, dy }) => {
        const applySnap = snapEnabled;
        // Build group start bounds
        if (!starts.length) return { dx, dy, guides: [] };
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const s of starts) {
          minX = Math.min(minX, s.x);
          minY = Math.min(minY, s.y);
          maxX = Math.max(maxX, s.x + s.w);
          maxY = Math.max(maxY, s.y + s.h);
        }
        const g = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        const startLeft = g.x;
        const startRight = g.x + g.w;
        const startCx = g.x + g.w / 2;
        const startTop = g.y;
        const startBottom = g.y + g.h;
        const startCy = g.y + g.h / 2;

        const threshold = 6; // px in stage coordinates
        let bestDxAdj: { adj: number; atX: number } | null = null;
        let bestDyAdj: { adj: number; atY: number } | null = null;

        // Consider other objects (exclude moving ones)
        const movingIds = new Set(starts.map((s) => s.id));
        const others: { id: string; x: number; y: number; w: number; h: number }[] = [];
        itemBoundsRef.current.forEach((b, id) => {
          if (!movingIds.has(id)) others.push({ id, x: b.x, y: b.y, w: b.width, h: b.height });
        });

        // Add stage edges/centers as virtual objects for helpful snapping
        const virtuals = [
          { x: 0, y: 0, w: STAGE_WIDTH, h: STAGE_HEIGHT, id: "__stage__" },
        ];
        for (const b of [...others, ...virtuals]) {
          const left = b.x;
          const right = b.x + b.w;
          const cx = b.x + b.w / 2;
          const top = b.y;
          const bottom = b.y + b.h;
          const cy = b.y + b.h / 2;
          const candidatesX: Array<{ target: number; source: number }> = [
            { target: left, source: startLeft },
            { target: cx, source: startCx },
            { target: right, source: startRight },
          ];
          for (const c of candidatesX) {
            const adj = c.target - (c.source + dx);
            if (Math.abs(adj) <= threshold) {
              if (!bestDxAdj || Math.abs(adj) < Math.abs(bestDxAdj.adj)) {
                bestDxAdj = { adj, atX: c.target };
              }
            }
          }
          const candidatesY: Array<{ target: number; source: number }> = [
            { target: top, source: startTop },
            { target: cy, source: startCy },
            { target: bottom, source: startBottom },
          ];
          for (const c of candidatesY) {
            const adj = c.target - (c.source + dy);
            if (Math.abs(adj) <= threshold) {
              if (!bestDyAdj || Math.abs(adj) < Math.abs(bestDyAdj.adj)) {
                bestDyAdj = { adj, atY: c.target };
              }
            }
          }
        }

        let snappedDx = dx;
        let snappedDy = dy;
        const outGuides: Guide[] = [];
        if (bestDxAdj) {
          if (applySnap) snappedDx += bestDxAdj.adj;
          outGuides.push({ kind: "v-line", x: bestDxAdj.atX });
        }
        if (bestDyAdj) {
          if (applySnap) snappedDy += bestDyAdj.adj;
          outGuides.push({ kind: "h-line", y: bestDyAdj.atY });
        }

        // Spacing equalization indicators (no magnetism, just labels)
        const finalLeft = startLeft + snappedDx;
        const finalRight = startRight + snappedDx;
        const finalTop = startTop + snappedDy;
        const finalBottom = startBottom + snappedDy;
        const finalCx = (finalLeft + finalRight) / 2;
        const finalCy = (finalTop + finalBottom) / 2;

        const horizNeighbors = others.filter(
          (b) => !(b.y + b.h < finalTop || b.y > finalBottom)
        );
        const leftNeighbor = horizNeighbors
          .filter((b) => b.x + b.w <= finalLeft)
          .sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
        const rightNeighbor = horizNeighbors
          .filter((b) => b.x >= finalRight)
          .sort((a, b) => a.x - b.x)[0];
        if (leftNeighbor) {
          const gapLeft = finalLeft - (leftNeighbor.x + leftNeighbor.w);
          const y = Math.max(
            finalTop,
            Math.min(
              finalBottom,
              (leftNeighbor.y + leftNeighbor.y + leftNeighbor.h) / 2
            )
          );
          outGuides.push({ kind: "h-gap", fromX: leftNeighbor.x + leftNeighbor.w, toX: finalLeft, y, label: `${Math.round(gapLeft)}` });
        }
        if (rightNeighbor) {
          const gapRight = rightNeighbor.x - finalRight;
          const y = Math.max(
            finalTop,
            Math.min(
              finalBottom,
              (rightNeighbor.y + rightNeighbor.y + rightNeighbor.h) / 2
            )
          );
          outGuides.push({ kind: "h-gap", fromX: finalRight, toX: rightNeighbor.x, y, label: `${Math.round(gapRight)}` });
        }

        const vertNeighbors = others.filter(
          (b) => !(b.x + b.w < finalLeft || b.x > finalRight)
        );
        const topNeighbor = vertNeighbors
          .filter((b) => b.y + b.h <= finalTop)
          .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
        const bottomNeighbor = vertNeighbors
          .filter((b) => b.y >= finalBottom)
          .sort((a, b) => a.y - b.y)[0];
        if (topNeighbor) {
          const gapTop = finalTop - (topNeighbor.y + topNeighbor.h);
          const x = Math.max(
            finalLeft,
            Math.min(
              finalRight,
              (topNeighbor.x + topNeighbor.x + topNeighbor.w) / 2
            )
          );
          outGuides.push({ kind: "v-gap", fromY: topNeighbor.y + topNeighbor.h, toY: finalTop, x, label: `${Math.round(gapTop)}` });
        }
        if (bottomNeighbor) {
          const gapBottom = bottomNeighbor.y - finalBottom;
          const x = Math.max(
            finalLeft,
            Math.min(
              finalRight,
              (bottomNeighbor.x + bottomNeighbor.x + bottomNeighbor.w) / 2
            )
          );
          outGuides.push({ kind: "v-gap", fromY: finalBottom, toY: bottomNeighbor.y, x, label: `${Math.round(gapBottom)}` });
        }

        // Also show center crosshair guidelines when snapping to centers (if near)
        if (!bestDxAdj && Math.abs(finalCx - STAGE_WIDTH / 2) <= threshold) {
          outGuides.push({ kind: "v-line", x: STAGE_WIDTH / 2 });
        }
        if (!bestDyAdj && Math.abs(finalCy - STAGE_HEIGHT / 2) <= threshold) {
          outGuides.push({ kind: "h-line", y: STAGE_HEIGHT / 2 });
        }

        return { dx: snappedDx, dy: snappedDy, guides: outGuides };
      },
      computeSnappedResize: ({ id, handle, proposed, minSize = 24 }) => {
        const applySnap = snapEnabled;
        const threshold = 6;
        const guides: Guide[] = [];
        // Collect other bounds and stage virtuals
        const others: { id: string; x: number; y: number; w: number; h: number }[] = [];
        itemBoundsRef.current.forEach((b, otherId) => {
          if (otherId !== id) others.push({ id: otherId, x: b.x, y: b.y, w: b.width, h: b.height });
        });
        const virtuals = [{ x: 0, y: 0, w: STAGE_WIDTH, h: STAGE_HEIGHT, id: "__stage__" }];

        let { x, y, width, height } = proposed;
        const affectsX = handle.includes("left") || handle.includes("right");
        const affectsY = handle.includes("top") || handle.includes("bottom");

        if (affectsX) {
          const proposedLeft = x;
          const proposedRight = x + width;
          let bestAdjX: { edge: "left" | "right"; adj: number; atX: number } | null = null;

          const targetsX: number[] = [];
          for (const b of [...others, ...virtuals]) {
            targetsX.push(b.x, b.x + b.w / 2, b.x + b.w);
          }
          if (handle.includes("right")) {
            for (const t of targetsX) {
              const adj = t - proposedRight;
              if (Math.abs(adj) <= threshold) {
                if (!bestAdjX || Math.abs(adj) < Math.abs(bestAdjX.adj)) bestAdjX = { edge: "right", adj, atX: t };
              }
            }
            if (bestAdjX) {
              if (applySnap) {
                const snappedRight = proposedRight + bestAdjX.adj;
                width = Math.max(minSize, Math.min(snappedRight - proposedLeft, STAGE_WIDTH - proposedLeft));
              }
              guides.push({ kind: "v-line", x: bestAdjX.atX });
            }
          } else if (handle.includes("left")) {
            for (const t of targetsX) {
              const adj = t - proposedLeft;
              if (Math.abs(adj) <= threshold) {
                if (!bestAdjX || Math.abs(adj) < Math.abs(bestAdjX.adj)) bestAdjX = { edge: "left", adj, atX: t };
              }
            }
            if (bestAdjX) {
              if (applySnap) {
                const snappedLeft = proposedLeft + bestAdjX.adj;
                const staticRight = proposedRight;
                const newX = Math.max(0, Math.min(snappedLeft, staticRight - minSize));
                width = Math.max(minSize, Math.min(staticRight - newX, STAGE_WIDTH));
                x = newX;
              }
              guides.push({ kind: "v-line", x: bestAdjX.atX });
            }
          }
        }

        if (affectsY) {
          const proposedTop = y;
          const proposedBottom = y + height;
          let bestAdjY: { edge: "top" | "bottom"; adj: number; atY: number } | null = null;

          const targetsY: number[] = [];
          for (const b of [...others, ...virtuals]) {
            targetsY.push(b.y, b.y + b.h / 2, b.y + b.h);
          }
          if (handle.includes("bottom")) {
            for (const t of targetsY) {
              const adj = t - proposedBottom;
              if (Math.abs(adj) <= threshold) {
                if (!bestAdjY || Math.abs(adj) < Math.abs(bestAdjY.adj)) bestAdjY = { edge: "bottom", adj, atY: t };
              }
            }
            if (bestAdjY) {
              if (applySnap) {
                const snappedBottom = proposedBottom + bestAdjY.adj;
                height = Math.max(minSize, Math.min(snappedBottom - proposedTop, STAGE_HEIGHT - proposedTop));
              }
              guides.push({ kind: "h-line", y: bestAdjY.atY });
            }
          } else if (handle.includes("top")) {
            for (const t of targetsY) {
              const adj = t - proposedTop;
              if (Math.abs(adj) <= threshold) {
                if (!bestAdjY || Math.abs(adj) < Math.abs(bestAdjY.adj)) bestAdjY = { edge: "top", adj, atY: t };
              }
            }
            if (bestAdjY) {
              if (applySnap) {
                const snappedTop = proposedTop + bestAdjY.adj;
                const staticBottom = proposedBottom;
                const newY = Math.max(0, Math.min(snappedTop, staticBottom - minSize));
                height = Math.max(minSize, Math.min(staticBottom - newY, STAGE_HEIGHT));
                y = newY;
              }
              guides.push({ kind: "h-line", y: bestAdjY.atY });
            }
          }
        }

        // Final clamp to stage bounds
        x = clamp(x, 0, STAGE_WIDTH - width);
        y = clamp(y, 0, STAGE_HEIGHT - height);
        width = clamp(width, 1, STAGE_WIDTH);
        height = clamp(height, 1, STAGE_HEIGHT);
        return { rect: { x, y, width, height }, guides };
      },
      updateGuides: (g) => setGuides(g),
    }),
    [scale, activeId, selectedIds, onItemsMoved]
  );

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  // Drive selection from outside when provided (supports multi-select)
  function setsEqual(a: Set<string>, b: Set<string>) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  useEffect(() => {
    if (selectedItemIdsFromOutside === undefined) return;
    const nextArray = selectedItemIdsFromOutside ?? [];
    const nextSet = new Set(nextArray);
    if (!setsEqual(nextSet, selectedIds)) {
      setSelectedIds(nextSet);
      setActiveId(nextArray.length ? nextArray[nextArray.length - 1] : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemIdsFromOutside]);

  // Keep a stable reference to the callback to avoid effect loops
  const onSelectionChangeRef = useRef<OverlayEditorCanvasProps["onSelectionChange"]>(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  // Notify parent when selection changes
  useEffect(() => {
    if (onSelectionChangeRef.current) onSelectionChangeRef.current(Array.from(selectedIds));
  }, [selectedIds]);

  function getStagePoint(ev: PointerEvent | React.PointerEvent) {
    const rect = stageRef.current!.getBoundingClientRect();
    const x = clamp((ev.clientX - rect.left) / scale, 0, STAGE_WIDTH);
    const y = clamp((ev.clientY - rect.top) / scale, 0, STAGE_HEIGHT);
    return { x, y };
  }

  // Non-passive wheel listener to allow preventDefault when Ctrl is pressed
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheelNative = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoomFactor((prev) => Math.max(0.1, prev * factor));
    };
    node.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheelNative as EventListener);
    };
  }, [viewportRef]);

  function startPan(e: React.PointerEvent) {
    // Middle mouse button drag to pan
    if (e.button !== 1) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = { ...pan };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "grabbing";
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setPan({ x: startPan.x + dx, y: startPan.y + dy });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startMarquee(e: React.PointerEvent) {
    // Begin marquee selection from stage background
    setActiveId(null);
    const start = getStagePoint(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setMarquee({ x: start.x, y: start.y, w: 0, h: 0 });
    setSelectedIds(new Set());

    function onMove(ev: PointerEvent) {
      const now = getStagePoint(ev);
      const x1 = Math.min(start.x, now.x);
      const y1 = Math.min(start.y, now.y);
      const x2 = Math.max(start.x, now.x);
      const y2 = Math.max(start.y, now.y);
      const rect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      setMarquee(rect);

      // Hit test against registered items
      const next = new Set<string>();
      itemBoundsRef.current.forEach((b, id) => {
        const intersects = !(b.x + b.width < rect.x || b.x > rect.x + rect.w || b.y + b.height < rect.y || b.y > rect.y + rect.h);
        if (intersects) next.add(id);
      });
      setSelectedIds(next);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMarquee(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Compute grouped selection bounds when multi-select is active (recompute every render)
  let groupBounds: { x: number; y: number; w: number; h: number } | null = null;
  if (selectedIds.size > 1) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    selectedIds.forEach((id) => {
      const b = itemBoundsRef.current.get(id);
      if (!b) return;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });
    if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
      groupBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }

  type Handle =
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";

  function startGroupResize(e: React.PointerEvent, handle: Handle) {
    if (!groupBounds) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...groupBounds };
    const centerX = start.x + start.w / 2;
    const centerY = start.y + start.h / 2;
    const maxWidthByCenter = 2 * Math.min(centerX, STAGE_WIDTH - centerX);
    const maxHeightByCenter = 2 * Math.min(centerY, STAGE_HEIGHT - centerY);
    const minSize = 24;

    // Snapshot per-item original positions/sizes
    const itemStarts = new Map<string, { x: number; y: number; w: number; h: number; keepSquare?: boolean }>();
    selectedIds.forEach((id) => {
      const b = itemBoundsRef.current.get(id);
      if (b) itemStarts.set(id, { x: b.x, y: b.y, w: b.width, h: b.height });
    });

    let raf = 0;
    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;

      const signedDx = handle.includes("right") ? dx : handle.includes("left") ? -dx : 0;
      const signedDy = handle.includes("bottom") ? dy : handle.includes("top") ? -dy : 0;
      const isCorner = handle.includes("-");
      let newW: number, newH: number, scaleX: number, scaleY: number;
      if (isCorner) {
        // Keep group aspect ratio by using uniform scale
        const sx = (start.w + 2 * signedDx) / start.w;
        const sy = (start.h + 2 * signedDy) / start.h;
        const sPick = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy;
        const sMin = minSize / start.w;
        const sMax = Math.min(maxWidthByCenter / start.w, maxHeightByCenter / start.h);
        const s = Math.min(Math.max(sPick, sMin), sMax);
        newW = start.w * s;
        newH = start.h * s;
        scaleX = s;
        scaleY = s;
      } else {
        // Edges: anchor opposite side and stretch only along that axis
        if (handle === "right") {
          newW = clamp(start.w + dx, minSize, STAGE_WIDTH - start.x);
          newH = start.h;
          scaleX = newW / start.w;
          scaleY = 1;
        } else if (handle === "left") {
          const newX = clamp(start.x + dx, 0, start.x + start.w - minSize);
          const w = start.w - (newX - start.x);
          newW = w;
          newH = start.h;
          // Scale relative to center; for positions we will recompute per item below
          scaleX = newW / start.w;
          scaleY = 1;
        } else if (handle === "bottom") {
          newH = clamp(start.h + dy, minSize, STAGE_HEIGHT - start.y);
          newW = start.w;
          scaleX = 1;
          scaleY = newH / start.h;
        } else {
          const newY = clamp(start.y + dy, 0, start.y + start.h - minSize);
          const h = start.h - (newY - start.y);
          newH = h;
          newW = start.w;
          scaleX = 1;
          scaleY = newH / start.h;
        }
      }

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        itemStarts.forEach((s, id) => {
          const sx = isCorner ? Math.max(scaleX, scaleY) : scaleX;
          const sy = isCorner ? Math.max(scaleX, scaleY) : scaleY;
          const cx = s.x + s.w / 2;
          const cy = s.y + s.h / 2;
          const relCx = cx - centerX;
          const relCy = cy - centerY;
          const nextW = Math.max(minSize, Math.min(s.w * sx, STAGE_WIDTH));
          const nextH = Math.max(minSize, Math.min(s.h * sy, STAGE_HEIGHT));
          const nextCx = centerX + relCx * sx;
          const nextCy = centerY + relCy * sy;
          let nextX = nextCx - nextW / 2;
          let nextY = nextCy - nextH / 2;
          // Clamp
          nextX = clamp(nextX, 0, STAGE_WIDTH - nextW);
          nextY = clamp(nextY, 0, STAGE_HEIGHT - nextH);
          const fn = itemUpdaterRef.current.get(id);
          if (fn) fn({ x: nextX, y: nextY, width: nextW, height: nextH });
        });
      });
    }
    function onUp() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const movedIds = new Set<string>();
      itemStarts.forEach((_s, id) => movedIds.add(id));
      ctxValue.notifyMoved(movedIds);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startGroupMove(e: React.PointerEvent) {
    if (!groupBounds) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;

    const itemStarts = new Map<string, { x: number; y: number; w: number; h: number }>();
    selectedIds.forEach((id) => {
      const b = itemBoundsRef.current.get(id);
      if (b) itemStarts.set(id, { x: b.x, y: b.y, w: b.width, h: b.height });
    });

    // Compute group delta limits so no item crosses stage bounds
    let groupDxMin = -Infinity;
    let groupDxMax = Infinity;
    let groupDyMin = -Infinity;
    let groupDyMax = Infinity;
    itemStarts.forEach((s) => {
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
      dx = clamp(dx, groupDxMin, groupDxMax);
      dy = clamp(dy, groupDyMin, groupDyMax);

      const startsArr = Array.from(itemStarts.entries()).map(([id, s]) => ({ id, x: s.x, y: s.y, w: s.w, h: s.h }));
      const snapped = ctxValue.computeSnappedDelta({ starts: startsArr, dx, dy });
      setGuides(snapped.guides);
      itemStarts.forEach((s, id) => {
        const nextX = s.x + snapped.dx;
        const nextY = s.y + snapped.dy;
        const fn = itemUpdaterRef.current.get(id);
        if (fn) fn({ x: nextX, y: nextY });
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setGuides([]);
      // Notify moved items
      const movedIds = new Set<string>();
      itemStarts.forEach((_s, id) => movedIds.add(id));
      ctxValue.notifyMoved(movedIds);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div ref={viewportRef} className="w-full h-full overflow-hidden relative opacity-90">
      <div className="absolute" style={{ left: offset.left, top: offset.top, width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}>
        <OverlayContext.Provider value={ctxValue}>
          <div
            ref={stageRef}
            className="relative bg-neutral-900 shadow-inner border border-white/10"
            style={{
              width: STAGE_WIDTH,
              height: STAGE_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%)," +
                "linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%)," +
                "linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.05) 75%)," +
                "linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.05) 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
            }}
            onPointerDown={(e) => {
              if (e.button === 1) startPan(e);
              else startMarquee(e);
            }}
          >
            {children}
            {/* Alignment and spacing guides */}
            {showGuides && guides.map((g, idx) => {
              if (g.kind === "v-line") {
                return (
                  <div key={idx} className="absolute bg-fuchsia-400/80" style={{ left: g.x, top: 0, width: 1, height: STAGE_HEIGHT, zIndex: 40 }} />
                );
              }
              if (g.kind === "h-line") {
                return (
                  <div key={idx} className="absolute bg-fuchsia-400/80" style={{ top: g.y, left: 0, height: 1, width: STAGE_WIDTH, zIndex: 40 }} />
                );
              }
              if (g.kind === "h-gap") {
                const x1 = Math.min(g.fromX, g.toX);
                const x2 = Math.max(g.fromX, g.toX);
                return (
                  <div key={idx} className="absolute" style={{ left: x1, top: g.y, width: x2 - x1, height: 1, zIndex: 41 }}>
                    <div className="absolute inset-0 bg-fuchsia-400/80" style={{ height: 1 }} />
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded bg-fuchsia-500/90 text-white border border-white/10">
                      {g.label}px
                    </div>
                  </div>
                );
              }
              // v-gap
              const y1 = Math.min(g.fromY, g.toY);
              const y2 = Math.max(g.fromY, g.toY);
              return (
                <div key={idx} className="absolute" style={{ top: y1, left: g.x, height: y2 - y1, width: 1, zIndex: 41 }}>
                  <div className="absolute inset-0 bg-fuchsia-400/80" style={{ width: 1 }} />
                  <div className="absolute -left-10 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded bg-fuchsia-500/90 text-white border border-white/10">
                    {g.label}px
                  </div>
                </div>
              );
            })}
            {marquee && (
              <div
                className="absolute border border-sky-400/80 bg-sky-400/20"
                style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, pointerEvents: "none" }}
              />
            )}
            {groupBounds && (
              <div
                className="absolute"
                style={{ left: groupBounds.x, top: groupBounds.y, width: groupBounds.w, height: groupBounds.h, zIndex: 20 }}
                onPointerDown={startGroupMove}
              >
                <div className="absolute inset-0 pointer-events-none border border-sky-400/90 rounded-md" />
                {/* Edge handles */}
                <div onPointerDown={(e) => startGroupResize(e, "left")} className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-sky-400 cursor-ew-resize" />
                <div onPointerDown={(e) => startGroupResize(e, "right")} className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-sky-400 cursor-ew-resize" />
                <div onPointerDown={(e) => startGroupResize(e, "top")} className="absolute top-0 left-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded bg-sky-400 cursor-ns-resize" />
                <div onPointerDown={(e) => startGroupResize(e, "bottom")} className="absolute bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded bg-sky-400 cursor-ns-resize" />
                {/* Corner handles */}
                <div onPointerDown={(e) => startGroupResize(e, "top-left")} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-sky-400 cursor-nwse-resize" />
                <div onPointerDown={(e) => startGroupResize(e, "top-right")} className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-sky-400 cursor-nesw-resize" />
                <div onPointerDown={(e) => startGroupResize(e, "bottom-left")} className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded bg-sky-400 cursor-nesw-resize" />
                <div onPointerDown={(e) => startGroupResize(e, "bottom-right")} className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 rounded bg-sky-400 cursor-nwse-resize" />
              </div>
            )}
          </div>
        </OverlayContext.Provider>
      </div>
    </div>
  );
}


