import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue } from "motion/react";
  
type TimelineProps = {
    durationMs: number;
    valueMs?: number;
    onChange?: (ms: number) => void;
    // Optional: set the initial total time window the timeline should show (zoom level)
    initialViewDurationMs?: number;
    // Optional: external, imperatively-driven playhead time in ms; used to move the playhead without causing React re-renders
    playheadMsRef?: React.MutableRefObject<number | null>;
    // Whether to follow the external playhead ref (e.g., while playing). Defaults to true
    followExternalPlayhead?: boolean;
    children?: React.ReactNode;
};

type ItemId = string | number | symbol;

type TimelineItemProps = {
	// Marker mode when only timeMs is provided
	timeMs?: number;
	// Segment mode when startMs and endMs are provided
	startMs?: number;
	endMs?: number;
    // Optional stable identifier for selection
    id?: ItemId;
	color?: string;
	label?: string;
	onChange?: (next: { startMs: number; endMs: number }) => void;
};

export default function Timeline({ durationMs, valueMs, onChange, initialViewDurationMs, playheadMsRef, followExternalPlayhead = true, children }: TimelineProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [internalMs, setInternalMs] = useState(0);
	const currentMs = valueMs ?? internalMs;
	const [selectedId, setSelectedId] = useState<ItemId | null>(null);

    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
	// Zoom/pan view state: viewStartMs denotes the first visible ms, viewDurationMs the window size mapped to the container width
    const [viewStartMs, setViewStartMs] = useState(0);
    const [viewDurationMs, setViewDurationMs] = useState(initialViewDurationMs ?? durationMs);
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const rect = entries[0].contentRect;
            setContainerWidth(rect.width);
            setContainerHeight(rect.height);
        });
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

    // Reset view when duration or initial view duration changes
    useEffect(() => {
        setViewStartMs(0);
        setViewDurationMs(Math.max(0, Math.min(durationMs, initialViewDurationMs ?? durationMs)));
    }, [durationMs, initialViewDurationMs]);

	const setMs = useCallback(
		(next: number) => {
			const clamped = Math.max(0, Math.min(durationMs, Math.floor(next)));
			onChange ? onChange(clamped) : setInternalMs(clamped);
		},
		[durationMs, onChange]
	);

	const msToX = useCallback(
		(ms: number) => (containerWidth === 0 ? 0 : ((ms - viewStartMs) / viewDurationMs) * containerWidth),
		[containerWidth, viewStartMs, viewDurationMs]
	);
	const xToMs = useCallback(
		(x: number) => (containerWidth === 0 ? 0 : viewStartMs + (x / containerWidth) * viewDurationMs),
		[containerWidth, viewStartMs, viewDurationMs]
	);

	const x = useMotionValue(0);
	const labelX = useMotionValue(0);
    const [isDragging, setIsDragging] = useState(false);
    // Lane registry to support vertical snapping between items
    // Vertical snap threshold in pixels (higher = easier to snap)
    const SNAP_THRESHOLD_PX = 20;
    // Fixed item height (Tailwind h-8 = 32px)
    const ITEM_HEIGHT_PX = 32;
    const laneMapRef = useRef<Map<ItemId, number>>(new Map());
    const setLaneTop = useCallback((id: ItemId, top: number) => { laneMapRef.current.set(id, top); }, []);
    const removeLane = useCallback((id: ItemId) => { laneMapRef.current.delete(id); }, []);
    const findSnapTop = useCallback((excludeId: ItemId | undefined, candidateTop: number) => {
        let nearest: number | null = null;
        let best = Infinity;
        laneMapRef.current.forEach((otherTop, key) => {
            if (excludeId != null && key === excludeId) return;
            // Snap options:
            // 1) top-to-top
            const dTopTop = Math.abs(otherTop - candidateTop);
            if (dTopTop < best) { best = dTopTop; nearest = otherTop; }
            // 2) top-to-bottom (align our top to other's bottom)
            const otherBottom = otherTop + ITEM_HEIGHT_PX;
            const dTopBottom = Math.abs(otherBottom - candidateTop);
            if (dTopBottom < best) { best = dTopBottom; nearest = otherBottom; }
            // 3) bottom-to-top (align our bottom to other's top)
            const ourTopIfBottomToTop = otherTop - ITEM_HEIGHT_PX;
            const dBottomTop = Math.abs(ourTopIfBottomToTop - candidateTop);
            if (dBottomTop < best) { best = dBottomTop; nearest = ourTopIfBottomToTop; }
        });
        return best <= SNAP_THRESHOLD_PX ? nearest : null;
    }, []);
	// Sync external/current value to handle position
	useEffect(() => {
		x.set(msToX(currentMs));
	}, [currentMs, msToX, x]);
	// Keep a clamped x for the playhead label so it stays within bounds
	useEffect(() => {
		const unsub = x.on("change", (latest) => {
			const clamped = Math.max(8, Math.min(Math.max(8, containerWidth - 8), latest));
			labelX.set(clamped);
		});
		return () => unsub();
	}, [x, containerWidth, labelX]);

    // If an external playhead ref is provided, drive x from it each frame without emitting onChange
    useEffect(() => {
        if (!playheadMsRef || !followExternalPlayhead) return;
        let raf: number;
        const loop = () => {
            const ms = playheadMsRef.current;
            if (!isDragging && typeof ms === "number") {
                x.set(msToX(ms));
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [playheadMsRef, msToX, x, isDragging, followExternalPlayhead]);

	// Click to seek
	const onContainerClick = useCallback((e: React.MouseEvent) => {
		const host = containerRef.current;
		if (!host) return;
		const rect = host.getBoundingClientRect();
		const nextX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
		setSelectedId(null);
		x.set(nextX);
		setMs(xToMs(nextX));
	}, [x, setMs, xToMs]);

	// Render simple background grid with repeating columns
	const gridStyle = useMemo(() => ({
		backgroundImage:
			"repeating-linear-gradient(to right, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 80px)",
	}), []);

	// time ticks every N seconds based on the current view window
	const stepSec = useMemo(() => {
		if (viewDurationMs <= 10_000) return 1;
		if (viewDurationMs <= 60_000) return 5;
		if (viewDurationMs <= 5 * 60_000) return 15;
		if (viewDurationMs <= 15 * 60_000) return 30;
		return 60;
	}, [viewDurationMs]);
	const labels = useMemo(() => {
		const arr: { t: number; left: number; label: string }[] = [];
		const start = Math.max(0, Math.floor(viewStartMs / (stepSec * 1000)) * stepSec * 1000);
		const end = Math.min(durationMs, viewStartMs + viewDurationMs);
		for (let t = start; t <= end; t += stepSec * 1000) {
			const left = containerWidth === 0 ? 0 : ((t - viewStartMs) / viewDurationMs) * 100;
			arr.push({ t, left, label: formatHMS(t) });
		}
		return arr;
	}, [durationMs, stepSec, containerWidth, viewStartMs, viewDurationMs]);

	// Ctrl + wheel to zoom centered around mouse position
	const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
		if (!e.ctrlKey) return;
		e.preventDefault();
		const host = containerRef.current;
		if (!host || containerWidth === 0) return;
		const rect = host.getBoundingClientRect();
		const pointerX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
		const pointerMs = xToMs(pointerX);
		const zoomFactor = Math.exp(-e.deltaY * 0.0015);
		const minDuration = Math.min(100, durationMs); // do not zoom in beyond 100ms or total duration if shorter
		let nextView = viewDurationMs / zoomFactor;
		nextView = Math.max(minDuration, Math.min(durationMs, nextView));
		let nextStart = pointerMs - (pointerX / containerWidth) * nextView;
		nextStart = Math.max(0, Math.min(nextStart, Math.max(0, durationMs - nextView)));
		setViewStartMs(nextStart);
		setViewDurationMs(nextView);
	}, [containerWidth, durationMs, viewDurationMs, xToMs]);

	// Scrollbar computations and interactions
	const thumbLeftPx = useMemo(() => (containerWidth === 0 || durationMs === 0 ? 0 : (viewStartMs / durationMs) * containerWidth), [containerWidth, viewStartMs, durationMs]);
	const thumbWidthPx = useMemo(() => (containerWidth === 0 || durationMs === 0 ? 0 : (viewDurationMs / durationMs) * containerWidth), [containerWidth, viewDurationMs, durationMs]);
	const onScrollbarThumbMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		const startX = e.clientX;
		const startView = viewStartMs;
		const onMove = (ev: MouseEvent) => {
			if (containerWidth === 0 || durationMs === 0) return;
			const dx = ev.clientX - startX;
			let nextStart = startView + (dx / containerWidth) * durationMs;
			nextStart = Math.max(0, Math.min(nextStart, Math.max(0, durationMs - viewDurationMs)));
			setViewStartMs(nextStart);
		};
		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}, [containerWidth, durationMs, viewDurationMs, viewStartMs]);

	const onScrollbarTrackMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
		const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
		if (rect.width === 0 || durationMs === 0) return;
		const pointerMs = (x / rect.width) * durationMs;
		let nextStart = pointerMs - viewDurationMs / 2;
		nextStart = Math.max(0, Math.min(nextStart, Math.max(0, durationMs - viewDurationMs)));
		setViewStartMs(nextStart);
	}, [durationMs, viewDurationMs]);

    return (
		<div className="w-full h-full select-none flex flex-col">
			<div
				ref={containerRef}
				className="relative flex-1 w-full border border-white/5 bg-[#14171D] overflow-hidden"
				style={gridStyle}
				onMouseDown={onContainerClick}
				onWheel={onWheel}
			>
				{/* Time labels */}
				<div className="absolute top-0 left-0 right-0 h-5">
					{labels.map((m) => (
						<div key={m.t} className="absolute -translate-x-1/2 text-[10px] text-white/50" style={{ left: `${m.left}%` }}>
							{m.label}
						</div>
					))}
				</div>
                {/* Items layer */}
                <Ctx.Provider value={{ durationMs, containerWidth, containerHeight, msToX, xToMs, selectedId, setSelectedId, setLaneTop, removeLane, findSnapTop }}>
					<div className="absolute inset-0">
						{children}
					</div>
				</Ctx.Provider>

				{/* Playhead/handle using motion drag */}
				<motion.div
					className="absolute top-0 bottom-0 w-px bg-sky-400"
					style={{ x }}
					drag="x"
					dragMomentum={false}
					dragConstraints={{ left: 0, right: Math.max(0, containerWidth) }}
                    onDragStart={() => setIsDragging(true)}
                    onDrag={() => setMs(xToMs(x.get()))}
                    onDragEnd={() => { setIsDragging(false); setMs(xToMs(x.get())); }}
				>
					{/* <div className="absolute -top-1 -left-2 right-[-8px] h-0 w-0 border-l-8 border-r-8 border-b-[10px] border-l-transparent border-r-transparent border-b-sky-400" /> */}
					<Bookmark className="absolute -top-1 -left-3 text-sky-400" fill="currentColor" />
				</motion.div>
			</div>
			{/* Current playhead time label */}
			<div className="mt-[-20px] relative h-5">
				<motion.div
					className="absolute -translate-x-1/2 px-1.5 py-0.5 rounded bg-black border border-white/10 text-[11px] text-white whitespace-nowrap"
					style={{ x: labelX }}
				>
					{formatHMS(currentMs)}
				</motion.div>
			</div>
			{/* Scrollbar */}
			<div className="h-4 w-full border border-white/5 bg-[#0f1217] relative" onMouseDown={onScrollbarTrackMouseDown}>
				<div
					className="absolute top-0 bottom-0 bg-white/15 hover:bg-white/25 cursor-pointer"
					style={{ left: thumbLeftPx, width: thumbWidthPx }}
					onMouseDown={onScrollbarThumbMouseDown}
				/>
			</div>
		</div>
	);
}

export function TimelineItem({ id, timeMs, startMs, endMs, color = "#22c55e", label, onChange }: TimelineItemProps) {
    const { durationMs, containerWidth, containerHeight, msToX, xToMs, selectedId, setSelectedId, setLaneTop, removeLane, findSnapTop } = useTimelineContext();
    // Ensure each instance has a unique identity even if 'id' props are duplicated
    const internalIdRef = useRef<ItemId>(id ?? Symbol('timeline-item'));
    const effectiveId = internalIdRef.current;

	// If start & end provided, render resizable segment, else render marker
	const isSegment = typeof startMs === "number" && typeof endMs === "number";
    const isControlled = isSegment && typeof onChange === "function";

	const [sMsState, setSMsState] = useState<number>(startMs ?? 0);
	const [eMsState, setEMsState] = useState<number>(endMs ?? (startMs ?? 0) + 1000);
	// In uncontrolled mode (no onChange), prefer internal state initialized from props
	const sMs = isControlled ? (startMs as number) : sMsState;
	const eMs = isControlled ? (endMs as number) : eMsState;

	// Keep internal state in sync with incoming props only when uncontrolled
	useEffect(() => {
		if (isControlled) return;
		if (typeof startMs === "number") setSMsState(startMs);
		if (typeof endMs === "number") setEMsState(endMs);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [startMs, endMs, isControlled]);

	// Motion values for segment position/size
	const leftX = useMotionValue(msToX(Math.max(0, Math.min(sMs, durationMs))));
	const widthX = useMotionValue(Math.max(0, msToX(Math.max(0, Math.min(eMs, durationMs))) - msToX(Math.max(0, Math.min(sMs, durationMs)))));
	const leftHandleDragX = useMotionValue(0);
	const rightHandleDragX = useMotionValue(0);
	const minWidthPx = 16;

	useEffect(() => {
		if (isSegment) {
			leftX.set(msToX(sMs));
			const nextWidth = Math.max(0, msToX(Math.max(0, eMs)) - msToX(Math.max(0, sMs)));
			widthX.set(nextWidth);
		}
	}, [isSegment, sMs, eMs, containerWidth, msToX, leftX, widthX]);

	const commit = useCallback((lx: number, wx: number) => {
		const nextStart = Math.max(0, Math.min(durationMs, xToMs(lx)));
		const nextEnd = Math.max(nextStart, Math.min(durationMs, xToMs(lx + wx)));
		if (onChange) onChange({ startMs: nextStart, endMs: nextEnd });
		else {
			setSMsState(nextStart);
			setEMsState(nextEnd);
		}
	}, [durationMs, onChange, xToMs]);

    if (isSegment) {
        const isSelected = selectedId != null && selectedId === effectiveId;
        // Track vertical stacking (lane) in pixels within the container
        const topY = useMotionValue(48); // default below ticks
        const minTop = 24; // keep under labels
        const maxTop = Math.max(minTop, (containerHeight ?? 112) - 32);
        // Register current lane top on mount/update
        useEffect(() => {
            if (setLaneTop) setLaneTop(effectiveId, topY.get());
            return () => { if (removeLane) removeLane(effectiveId); };
        }, [effectiveId, setLaneTop, removeLane, topY]);
        return (
            <motion.div
                className="absolute h-8 rounded border"
                drag
                dragMomentum={false}
                dragConstraints={{ left: 0, right: Math.max(0, containerWidth), top: minTop, bottom: maxTop }}
                dragElastic={0}
                style={{ x: leftX, y: topY, width: widthX, backgroundColor: withAlpha(color, 0.3), borderColor: isSelected ? `#60a5fa` : `${color}`, boxShadow: isSelected ? `0 0 0 2px #60a5fa` : undefined }}
                whileDrag={{ zIndex: 100 }}
                onMouseDown={(e) => { e.stopPropagation(); setSelectedId?.(effectiveId); }}
                onDragEnd={() => {
                    // Snap to nearest lane if within threshold
                    const candidate = topY.get();
                    const snap = findSnapTop ? findSnapTop(effectiveId, candidate) : null;
                    if (typeof snap === 'number') topY.set(snap);
                    if (setLaneTop) setLaneTop(effectiveId, topY.get());
                    commit(leftX.get(), widthX.get());
                }}
            >
                {/* The whole item is now draggable (x,y). Resize handles remain for width adjustments. */}
				{/* Start/End time labels (only when selected) */}
				{isSelected && (
					<>
						<div className="absolute -top-5 left-0 -translate-x-1/2 px-1 py-0.5 rounded bg-black/60 border border-white/10 text-[10px] text-white/70">
							{formatHMS(Math.max(0, Math.min(durationMs, xToMs(leftX.get()))))}
						</div>
						<div className="absolute -top-5 right-0 translate-x-1/2 px-1 py-0.5 rounded bg-black/60 border border-white/10 text-[10px] text-white/70">
							{formatHMS(Math.max(0, Math.min(durationMs, xToMs(leftX.get() + widthX.get()))))}
						</div>
					</>
				)}

                {/* Left resize handle */}
				<motion.div
					className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20 hover:bg-white/40 z-20"
                    style={{ x: leftHandleDragX }}
					drag="x"
					dragMomentum={false}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedId?.(effectiveId); }}
					onDrag={(_, info) => {
						const curLeft = leftX.get();
						const curWidth = widthX.get();
						let nextLeft = curLeft + info.delta.x;
						nextLeft = Math.max(0, Math.min(nextLeft, curLeft + curWidth - minWidthPx));
						leftX.set(nextLeft);
						widthX.set(Math.max(minWidthPx, curWidth + (curLeft - nextLeft)));
						leftHandleDragX.set(0);
					}}
					onDragEnd={() => {
						leftHandleDragX.set(0);
						commit(leftX.get(), widthX.get());
					}}
				/>

                {/* Right resize handle */}
				<motion.div
					className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20 hover:bg-white/40 z-20"
                    style={{ x: rightHandleDragX }}
					drag="x"
					dragMomentum={false}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedId?.(effectiveId); }}
					onDrag={(_, info) => {
						const curLeft = leftX.get();
						const curWidth = widthX.get();
						let nextWidth = curWidth + info.delta.x;
						nextWidth = Math.max(minWidthPx, Math.min(nextWidth, Math.max(0, containerWidth - curLeft)));
						widthX.set(nextWidth);
						rightHandleDragX.set(0);
					}}
					onDragEnd={() => {
						rightHandleDragX.set(0);
						commit(leftX.get(), widthX.get());
					}}
				/>

				{/* Optional centered label */}
				<div className="absolute inset-0 grid place-items-center text-[11px] text-white/80">
					{label}
				</div>
			</motion.div>
		);
	}

	// Marker fallback
	const leftPx = msToX(Number(timeMs ?? 0));
	const isSelected = selectedId != null && id != null && selectedId === id;
	return (
		<div className="absolute top-6 bottom-6" style={{ left: leftPx }} onMouseDown={(e) => { e.stopPropagation(); setSelectedId?.(id ?? null); }}>
			<div className="-translate-x-1/2 h-full w-[6px] rounded bg-white/10" style={{ boxShadow: isSelected ? `0 0 0 2px ${color}55` : undefined }} />
			<div
				className="absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] bg-black/60 border border-white/10 text-white/70 whitespace-nowrap"
				style={{ display: label ? undefined : "none" }}
			>
				{label}
			</div>
			<div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px]" style={{ background: color }} />
		</div>
	);
}

// Simple context so TimelineItem can access duration
import { createContext, useContext } from "react";
import { Bookmark } from "lucide-react";

type TimelineCtx = {
    durationMs: number;
    containerWidth: number;
    containerHeight?: number;
    msToX: (ms: number) => number;
    xToMs: (x: number) => number;
    selectedId?: ItemId | null;
    setSelectedId?: (id: ItemId | null) => void;
    // Optional lane snapping registry
    setLaneTop?: (id: ItemId, top: number) => void;
    removeLane?: (id: ItemId) => void;
    findSnapTop?: (excludeId: ItemId | undefined, candidateTop: number) => number | null;
};
const Ctx = createContext<TimelineCtx | null>(null);

function useTimelineContext(): TimelineCtx {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("TimelineItem must be used within <TimelineProvider>");
	return ctx;
}

export function TimelineProvider({ durationMs, children }: { durationMs: number; children: React.ReactNode }) {
	// Base provider (overridden by Timeline with real geometry)
	return <Ctx.Provider value={{ durationMs, containerWidth: 0, msToX: () => 0, xToMs: () => 0 }}>{children}</Ctx.Provider>;
}

function formatHMS(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const hh = hours.toString().padStart(2, "0");
	const mm = minutes.toString().padStart(2, "0");
	const ss = seconds.toString().padStart(2, "0");
	return `${hh}:${mm}:${ss}`;
}

// Convert any CSS color string (named, hex, rgb[a]) to an rgba string with the provided alpha
function withAlpha(input: string, alpha: number): string {
    if (!input) return `rgba(0,0,0,${alpha})`;
    // hex #rgb, #rrggbb, #rrggbbaa
    if (input.startsWith('#')) {
        let r = 0, g = 0, b = 0;
        const hex = input.replace('#', '');
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6 || hex.length === 8) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    }
    // rgb/rgba
    const rgbMatch = input.match(/rgba?\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*)(?:,\s*([\d.]+)\s*)?\)/i);
    if (rgbMatch) {
        const r = Number(rgbMatch[1]);
        const g = Number(rgbMatch[2]);
        const b = Number(rgbMatch[3]);
        return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    }
    // Fallback via canvas to resolve named colors to hex
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = input;
            const norm = ctx.fillStyle as string; // often becomes #rrggbb
            if (typeof norm === 'string' && norm.startsWith('#')) {
                return withAlpha(norm, alpha);
            }
        }
    } catch {}
    return input;
}


