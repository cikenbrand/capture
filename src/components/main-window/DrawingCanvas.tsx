import { useEffect, useRef, useState } from "react";

type Props = {
	enabled: boolean;
	onRequestDisable?: () => void;
};

export default function VideoDrawOverlay({ enabled, onRequestDisable }: Props) {
	const wrapperRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [ready, setReady] = useState(false);
	const videoRectRef = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);
	const [viewportRect, setViewportRect] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null);
	const [tool, setTool] = useState<'select' | 'arrow' | 'circle' | 'free' | 'rect' | 'eraser'>("arrow");
	const [color, setColor] = useState<string>("#ff2d2e");
	const [isInside, setIsInside] = useState(false);
	const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const prevEnabledRef = useRef<boolean>(enabled);
	const wsRef = useRef<WebSocket | null>(null);
	const channelRef = useRef<number>(1);
	const isChannelActiveRef = useRef<boolean>(false);
	const freePointsRef = useRef<Array<{ x: number; y: number }>>([]);
	const shapesRef = useRef<any[]>([]);
	const selectedRef = useRef<any | null>(null);

	// Invisible drawing: do not render any local preview on the canvas
	const SHOW_LOCAL_PREVIEW = false;


	// Update channel based on current OBS scene (only single_channel-1..4 are active for broadcasting)
	useEffect(() => {
		async function updateFromCurrentScene() {
			try {
				const name = await window.obs.getCurrentScene();
				const text = String(name || '');
				// Support both 'single_channel-N' and 'channel N'
				const m = text.match(/single_channel-(\d+)/i) || text.match(/channel\s*(\d+)/i);
				if (m) {
					const ch = Math.max(1, Math.min(4, Number(m[1]) || 1));
					channelRef.current = ch;
					isChannelActiveRef.current = true;
					try {
						const ws = wsRef.current;
						if (ws && ws.readyState === WebSocket.OPEN) {
							const items = shapesRef.current.filter(s => s.channel === channelRef.current);
							if (items.length && isChannelActiveRef.current) ws.send(JSON.stringify({ type: 'bulkSync', channel: channelRef.current, items, ts: Date.now() }));
						}
					} catch {}
				}
				else {
					isChannelActiveRef.current = false;
				}
			} catch {}
		}
		updateFromCurrentScene();
		const off = window.obs.onCurrentSceneChanged((_sceneName) => {
			updateFromCurrentScene();
		});
		return () => { try { off && off(); } catch {} };
	}, []);

	// WS connection to overlay_ws
	function sendState() {
		try {
			const ws = wsRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN) return;
			if (!isChannelActiveRef.current) return;
			const items = shapesRef.current.filter(s => s.channel === channelRef.current);
			const payload = { type: 'state', channel: channelRef.current, width: 1920, height: 1080, items, ts: Date.now() };
			ws.send(JSON.stringify(payload));
		} catch {}
	}
	useEffect(() => {
		let stopped = false;
		let timer: number | null = null;
		const port = (import.meta as any).env?.VITE_OVERLAY_WS_PORT ?? 3620;
		const url = `ws://127.0.0.1:${port}`;
		function open() {
			if (stopped) return;
			try {
				const ws = new WebSocket(url);
				wsRef.current = ws;
				ws.onopen = () => {
					try {
						const items = shapesRef.current.filter(s => s.channel === channelRef.current);
						if (items.length && isChannelActiveRef.current) ws.send(JSON.stringify({ type: 'bulkSync', channel: channelRef.current, items, ts: Date.now() }));
						if (isChannelActiveRef.current) sendState();
					} catch {}
				};
				ws.onclose = () => {
					if (!stopped) timer = window.setTimeout(open, 1000) as unknown as number;
				};
				ws.onerror = () => { try { ws.close(); } catch {} };
			} catch {}
		}
		open();
		return () => {
			stopped = true;
			if (timer) window.clearTimeout(timer as unknown as number);
			try { wsRef.current?.close(); } catch {}
		};
	}, []);

	// Context menu global handlers
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') setMenuPos(null);
		}
		function onDocMouseDown(e: MouseEvent) {
			const node = menuRef.current;
			if (!node) return;
			if (!node.contains(e.target as Node)) setMenuPos(null);
		}
		window.addEventListener('keydown', onKeyDown);
		document.addEventListener('mousedown', onDocMouseDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('mousedown', onDocMouseDown);
		};
	}, []);

	function isInsideVideo(x: number, y: number): boolean {
		const vr = videoRectRef.current;
		if (!vr) return true;
		return x >= vr.left && x <= vr.right && y >= vr.top && y <= vr.bottom;
	}

	function pxFromNormX(nx: number): number {
		const vr = videoRectRef.current;
		if (!vr) return nx;
		return vr.left + nx * (vr.right - vr.left);
	}

	function pxFromNormY(ny: number): number {
		const vr = videoRectRef.current;
		if (!vr) return ny;
		return vr.top + ny * (vr.bottom - vr.top);
	}

	function renderAll(ctx: CanvasRenderingContext2D) {
		if (!SHOW_LOCAL_PREVIEW) return;
		ctx.clearRect(0, 0, (canvasRef.current?.width || 0), (canvasRef.current?.height || 0));
		const vr = videoRectRef.current;
		if (vr) {
			ctx.save();
			ctx.beginPath();
			ctx.rect(vr.left, vr.top, vr.right - vr.left, vr.bottom - vr.top);
			ctx.clip();
		}
		const items = shapesRef.current.filter(s => s.channel === channelRef.current);
		for (const s of items) {
			try {
				if (s.type === 'drawArrow') {
					const x1 = pxFromNormX(s.nx1);
					const y1 = pxFromNormY(s.ny1);
					const x2 = pxFromNormX(s.nx2);
					const y2 = pxFromNormY(s.ny2);
					ctx.strokeStyle = s.color || color;
					ctx.fillStyle = s.color || color;
					ctx.lineWidth = 3;
					ctx.lineJoin = 'round';
					ctx.lineCap = 'round';
					ctx.beginPath();
					ctx.moveTo(x1, y1);
					ctx.lineTo(x2, y2);
					ctx.stroke();
					const headLength = 12;
					const angle = Math.atan2(y2 - y1, x2 - x1);
					const hx1 = x2 - headLength * Math.cos(angle - Math.PI / 6);
					const hy1 = y2 - headLength * Math.sin(angle - Math.PI / 6);
					const hx2 = x2 - headLength * Math.cos(angle + Math.PI / 6);
					const hy2 = y2 - headLength * Math.sin(angle + Math.PI / 6);
					ctx.beginPath();
					ctx.moveTo(x2, y2);
					ctx.lineTo(hx1, hy1);
					ctx.lineTo(hx2, hy2);
					ctx.closePath();
					ctx.fill();
				} else if (s.type === 'drawCircle') {
					const cx = pxFromNormX(s.cx);
					const cy = pxFromNormY(s.cy);
					const rx = (videoRectRef.current ? (videoRectRef.current.right - videoRectRef.current.left) : 1) * (s.rx || 0);
					const ry = (videoRectRef.current ? (videoRectRef.current.bottom - videoRectRef.current.top) : 1) * (s.ry || 0);
					ctx.strokeStyle = s.color || color;
					ctx.lineWidth = 3;
					ctx.lineJoin = 'round';
					ctx.lineCap = 'round';
					ctx.beginPath();
					try { ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2); } catch {}
					ctx.stroke();
				} else if (s.type === 'drawRect') {
					const x = pxFromNormX(s.x);
					const y = pxFromNormY(s.y);
					const w = (videoRectRef.current ? (videoRectRef.current.right - videoRectRef.current.left) : 1) * (s.w || 0);
					const h = (videoRectRef.current ? (videoRectRef.current.bottom - videoRectRef.current.top) : 1) * (s.h || 0);
					ctx.strokeStyle = s.color || color;
					ctx.lineWidth = 3;
					try { ctx.strokeRect(x, y, w, h); } catch {}
				} else if (s.type === 'drawFree') {
					const pts = (s.points || []).map((p: any) => ({ x: pxFromNormX(p.x), y: pxFromNormY(p.y) }));
					if (pts.length >= 2) {
						ctx.strokeStyle = s.color || color;
						ctx.lineWidth = 3;
						ctx.lineJoin = 'round';
						ctx.lineCap = 'round';
						ctx.beginPath();
						ctx.moveTo(pts[0].x, pts[0].y);
						for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
						ctx.stroke();
					}
				}
			} catch {}
		}
		if (vr) ctx.restore();

		// Draw selection outline if any
		const sel = selectedRef.current;
		if (sel && sel.channel === channelRef.current) {
			try {
				const bounds = (function() {
					const v = videoRectRef.current;
					if (!v) return null;
					const make = (l:number,t:number,r:number,b:number) => ({ left:l, top:t, right:r, bottom:b, w: Math.max(1, r-l), h: Math.max(1, b-t) })
					if (sel.type === 'drawArrow') {
						const x1 = pxFromNormX(sel.nx1||0), y1 = pxFromNormY(sel.ny1||0);
						const x2 = pxFromNormX(sel.nx2||0), y2 = pxFromNormY(sel.ny2||0);
						return make(Math.min(x1,x2), Math.min(y1,y2), Math.max(x1,x2), Math.max(y1,y2));
					} else if (sel.type === 'drawCircle') {
						const cx = pxFromNormX(sel.cx||0), cy = pxFromNormY(sel.cy||0);
						const r = Math.max((v.right - v.left) * (sel.rx || sel.r || 0), (v.bottom - v.top) * (sel.ry || sel.r || 0));
						return make(cx - r, cy - r, cx + r, cy + r);
					} else if (sel.type === 'drawRect') {
						const x = pxFromNormX(sel.x||0), y = pxFromNormY(sel.y||0);
						const w = (v.right - v.left) * (sel.w || 0);
						const h = (v.bottom - v.top) * (sel.h || 0);
						return make(x, y, x + w, y + h);
					} else if (sel.type === 'drawFree') {
						const pts = (sel.points||[]).map((p:any)=>({ x:pxFromNormX(p.x||0), y:pxFromNormY(p.y||0) }));
						if (!pts.length) return null;
						let left = pts[0].x, right = pts[0].x, top = pts[0].y, bottom = pts[0].y;
						for (const p of pts) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y); }
						return make(left, top, right, bottom);
					}
					return null;
				})();
				if (bounds) {
					ctx.save();
					ctx.setLineDash([6, 4]);
					ctx.strokeStyle = '#67A8FF';
					ctx.lineWidth = 1;
					ctx.strokeRect(bounds.left - 3, bounds.top - 3, bounds.w + 6, bounds.h + 6);
					ctx.restore();
				}
			} catch {}
		}
	}

	useEffect(() => {
		function computeAndSetVideoRect() {
			const wrapperNode = wrapperRef.current as HTMLDivElement | null;
			const canvasNode = canvasRef.current as HTMLCanvasElement | null;
			if (!wrapperNode || !canvasNode) return;
			const rect = wrapperNode.getBoundingClientRect();
			// Find the actual <video> element rendered by react-webcam from the common parent
			let videoEl: HTMLVideoElement | null = null;
			try {
				const container = wrapperNode.parentElement; // absolute overlay container
				const root = container?.parentElement || document.body;
				videoEl = root.querySelector('video') as HTMLVideoElement | null;
			} catch {}
			let vLeft = 0, vTop = 0, vRight = rect.width, vBottom = rect.height;
			if (videoEl) {
				const elemW = rect.width;
				const elemH = rect.height;
				const naturalW = videoEl.videoWidth || 0;
				const naturalH = videoEl.videoHeight || 0;
				if (naturalW > 0 && naturalH > 0 && elemW > 0 && elemH > 0) {
					const scale = Math.min(elemW / naturalW, elemH / naturalH);
					const contentW = naturalW * scale;
					const contentH = naturalH * scale;
					vLeft = Math.max(0, (elemW - contentW) / 2);
					vTop = Math.max(0, (elemH - contentH) / 2);
					vRight = vLeft + contentW;
					vBottom = vTop + contentH;
				}
			}
			videoRectRef.current = { left: vLeft, top: vTop, right: vRight, bottom: vBottom };
			// Also compute viewport-space rectangle for global overlays
			setViewportRect({
				left: rect.left + vLeft,
				top: rect.top + vTop,
				right: rect.left + vRight,
				bottom: rect.top + vBottom,
			});
		}

		function resize() {
			const wrapperNode = wrapperRef.current as HTMLDivElement | null;
			const canvasNode = canvasRef.current as HTMLCanvasElement | null;
			if (!wrapperNode || !canvasNode) return;
			const rect = wrapperNode.getBoundingClientRect();
			const dpr = Math.max(1, window.devicePixelRatio || 1);
			canvasNode.width = Math.max(1, Math.floor(rect.width * dpr));
			canvasNode.height = Math.max(1, Math.floor(rect.height * dpr));
			canvasNode.style.width = `${Math.floor(rect.width)}px`;
			canvasNode.style.height = `${Math.floor(rect.height)}px`;
			const ctx = canvasNode.getContext('2d');
			if (ctx) {
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			}
			computeAndSetVideoRect();
		}

		const wrapperNode = wrapperRef.current as HTMLDivElement | null;
		if (!wrapperNode) return;
		const ro = new ResizeObserver(() => resize());
		ro.observe(wrapperNode);
		resize();
		// Also listen for metadata load to recompute when video intrinsic size becomes available
		let videoEl: HTMLVideoElement | null = null;
		try {
			const container = wrapperNode.parentElement;
			const root = container?.parentElement || document.body;
			videoEl = root.querySelector('video') as HTMLVideoElement | null;
		} catch {}
		function onMeta() { computeAndSetVideoRect(); }
		if (videoEl) videoEl.addEventListener('loadedmetadata', onMeta);
		setReady(true);
		return () => {
			try { ro.disconnect(); } catch {}
			if (videoEl) videoEl.removeEventListener('loadedmetadata', onMeta);
		};
	}, []);

	useEffect(() => {
		const canvasRefCurrent = canvasRef.current as HTMLCanvasElement | null;
		if (!canvasRefCurrent) return;
		const canvasNode = canvasRefCurrent as HTMLCanvasElement;
		let drawing = false;
		let startX = 0;
		let startY = 0;

		function getXY(e: PointerEvent) {
			const rect = canvasNode.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			return { x, y };
		}


		function clampToVideo(x: number, y: number) {
			const vr = videoRectRef.current;
			if (!vr) return { x, y };
			const cx = Math.min(Math.max(x, vr.left), vr.right);
			const cy = Math.min(Math.max(y, vr.top), vr.bottom);
			return { x: cx, y: cy };
		}

		function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
			ctx.strokeStyle = color;
			ctx.fillStyle = color;
			ctx.lineWidth = 3;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
			const headLength = 12;
			const angle = Math.atan2(y2 - y1, x2 - x1);
			const hx1 = x2 - headLength * Math.cos(angle - Math.PI / 6);
			const hy1 = y2 - headLength * Math.sin(angle - Math.PI / 6);
			const hx2 = x2 - headLength * Math.cos(angle + Math.PI / 6);
			const hy2 = y2 - headLength * Math.sin(angle + Math.PI / 6);
			ctx.beginPath();
			ctx.moveTo(x2, y2);
			ctx.lineTo(hx1, hy1);
			ctx.lineTo(hx2, hy2);
			ctx.closePath();
			ctx.fill();
		}

		function drawCircleFromCenter(ctx: CanvasRenderingContext2D, cx: number, cy: number, ex: number, ey: number) {
			ctx.strokeStyle = color;
			ctx.lineWidth = 3;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			const r = Math.max(1, Math.hypot(ex - cx, ey - cy));
			ctx.beginPath();
			try {
				ctx.arc(cx, cy, r, 0, Math.PI * 2);
			} catch {}
			ctx.stroke();
		}

		function drawSquareFromStart(ctx: CanvasRenderingContext2D, sx: number, sy: number, ex: number, ey: number) {
			ctx.strokeStyle = color;
			ctx.lineWidth = 3;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			// Enforce a perfect square by using the larger delta as side length
			const dx = ex - sx;
			const dy = ey - sy;
			const side = Math.max(Math.abs(dx), Math.abs(dy));
			const rx = dx >= 0 ? side : -side;
			const ry = dy >= 0 ? side : -side;
			const left = Math.min(sx, sx + rx);
			const top = Math.min(sy, sy + ry);
			const size = Math.abs(side);
			try { ctx.strokeRect(left, top, size, size); } catch {}
		}

		function drawFreePath(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) {
			if (points.length < 2) return;
			ctx.strokeStyle = color;
			ctx.lineWidth = 3;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) {
				ctx.lineTo(points[i].x, points[i].y);
			}
			ctx.stroke();
		}

		function hitTest(x: number, y: number) {
			const vr = videoRectRef.current
			const px = x, py = y
			const items = shapesRef.current.filter(s => s.channel === channelRef.current)
			const tolerance = 6
			for (let i = items.length - 1; i >= 0; i--) {
				const s = items[i]
				try {
					if (s.type === 'drawRect') {
						const left = (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (s.x || 0)
						const top = (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (s.y || 0)
						const w = (vr ? (vr.right - vr.left) : 1) * (s.w || 0)
						const h = (vr ? (vr.bottom - vr.top) : 1) * (s.h || 0)
						if (px >= left && px <= left + w && py >= top && py <= top + h) return { s, left, top, w, h }
					} else if (s.type === 'drawCircle') {
						const cx = (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (s.cx || 0)
						const cy = (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (s.cy || 0)
						const rx = (vr ? (vr.right - vr.left) : 1) * (s.rx || 0)
						const ry = (vr ? (vr.bottom - vr.top) : 1) * (s.ry || 0)
						const r = Math.max(rx, ry)
						const d = Math.hypot(px - cx, py - cy)
						if (d <= r + tolerance) return { s, cx, cy, r }
					} else if (s.type === 'drawArrow') {
						const x1 = (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (s.nx1 || 0)
						const y1 = (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (s.ny1 || 0)
						const x2 = (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (s.nx2 || 0)
						const y2 = (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (s.ny2 || 0)
						const A = px - x1; const B = py - y1; const C = x2 - x1; const D = y2 - y1
						const dot = A * C + B * D; const len_sq = C * C + D * D; let param = -1; if (len_sq !== 0) param = dot / len_sq
						let xx, yy; if (param < 0) { xx = x1; yy = y1 } else if (param > 1) { xx = x2; yy = y2 } else { xx = x1 + param * C; yy = y1 + param * D }
						const dx = px - xx; const dy = py - yy; if (Math.hypot(dx, dy) <= tolerance) return { s }
					} else if (s.type === 'drawFree') {
						const vrLeft = (vr ? vr.left : 0), vrTop = (vr ? vr.top : 0)
						const vrW = (vr ? (vr.right - vr.left) : 1), vrH = (vr ? (vr.bottom - vr.top) : 1)
						const pts = (s.points || []).map((p: any) => ({ x: vrLeft + vrW * (p.x || 0), y: vrTop + vrH * (p.y || 0) }))
						for (let j = 1; j < pts.length; j++) {
							const a = pts[j - 1]; const b = pts[j]
							const A = px - a.x; const B = py - a.y; const C = b.x - a.x; const D = b.y - a.y
							const dot = A * C + B * D; const len_sq = C * C + D * D; let param = -1; if (len_sq !== 0) param = dot / len_sq
							let xx, yy; if (param < 0) { xx = a.x; yy = a.y } else if (param > 1) { xx = b.x; yy = b.y } else { xx = a.x + param * C; yy = a.y + param * D }
							const dx = px - xx; const dy = py - yy; if (Math.hypot(dx, dy) <= tolerance) return { s }
						}
					}
				} catch {}
			}
			return null
		}

		let dragging: { s: any, startX: number, startY: number, base: any } | null = null

		function onDown(e: PointerEvent) {
			if (e.button !== 0) return;
			if (!enabled) return;
			let xy = getXY(e);
			let x = xy.x; let y = xy.y;
			if (tool === 'select') {
				const hit = hitTest(x, y)
				if (hit) {
					selectedRef.current = hit.s
					const vr = videoRectRef.current
					const vrLeft = (vr ? vr.left : 0), vrTop = (vr ? vr.top : 0)
					const vrW = (vr ? (vr.right - vr.left) : 1), vrH = (vr ? (vr.bottom - vr.top) : 1)
					let base: any = {}
					if (hit.s.type === 'drawArrow') {
						base = {
							x1: vrLeft + vrW * (hit.s.nx1 || 0),
							y1: vrTop + vrH * (hit.s.ny1 || 0),
							x2: vrLeft + vrW * (hit.s.nx2 || 0),
							y2: vrTop + vrH * (hit.s.ny2 || 0),
						}
					} else if (hit.s.type === 'drawCircle') {
						base = {
							cx: vrLeft + vrW * (hit.s.cx || 0),
							cy: vrTop + vrH * (hit.s.cy || 0),
						}
					} else if (hit.s.type === 'drawRect') {
						base = {
							x: vrLeft + vrW * (hit.s.x || 0),
							y: vrTop + vrH * (hit.s.y || 0),
						}
					} else if (hit.s.type === 'drawFree') {
						base = {
							points: (hit.s.points || []).map((p: any) => ({ x: vrLeft + vrW * (p.x || 0), y: vrTop + vrH * (p.y || 0) })),
						}
					}
					canvasNode.setPointerCapture(e.pointerId)
					dragging = { s: hit.s, startX: x, startY: y, base }
				} else {
					// Clicked empty area inside canvas -> deselect
					selectedRef.current = null
				}
				const ctxSel = canvasNode.getContext('2d'); if (ctxSel) renderAll(ctxSel)
				return
			}
			canvasNode.setPointerCapture(e.pointerId);
			const ctx = canvasNode.getContext('2d');
			if (!ctx) return;
			xy = getXY(e);
			x = xy.x; y = xy.y;
			if (!isInsideVideo(x, y)) {
				// Ignore clicks outside the video; do not disable edit mode.
				return;
			}
			if (tool === 'eraser') {
				const hit = (function() {
					const vr = videoRectRef.current;
					const px = x, py = y;
					// hit test
					const items = shapesRef.current.filter(s => s.channel === channelRef.current);
					const tolerance = 6;
					for (let i = items.length - 1; i >= 0; i--) {
						const s = items[i];
						try {
							if (s.type === 'drawRect') {
								const left = (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (s.x || 0);
								const top = (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (s.y || 0);
								const w = (vr ? (vr.right - vr.left) : 1) * (s.w || 0);
								const h = (vr ? (vr.bottom - vr.top) : 1) * (s.h || 0);
								if (px >= left && px <= left + w && py >= top && py <= top + h) return s;
							} else if (s.type === 'drawCircle') {
								const cx = (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (s.cx || 0);
								const cy = (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (s.cy || 0);
								const rx = (vr ? (vr.right - vr.left) : 1) * (s.rx || 0);
								const ry = (vr ? (vr.bottom - vr.top) : 1) * (s.ry || 0);
								const r = Math.max(rx, ry);
								const d = Math.hypot(px - cx, py - cy);
								if (Math.abs(d - r) <= tolerance || d < r) return s;
							} else if (s.type === 'drawArrow') {
								const x1 = (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (s.nx1 || 0);
								const y1 = (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (s.ny1 || 0);
								const x2 = (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (s.nx2 || 0);
								const y2 = (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (s.ny2 || 0);
								const A = px - x1; const B = py - y1; const C = x2 - x1; const D = y2 - y1;
								const dot = A * C + B * D; const len_sq = C * C + D * D; let param = -1; if (len_sq !== 0) param = dot / len_sq;
								let xx, yy; if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
								const dx = px - xx; const dy = py - yy; if (Math.hypot(dx, dy) <= tolerance) return s;
							} else if (s.type === 'drawFree') {
								const pts = (s.points || []).map((p: any) => ({
									x: (vr ? vr.left : 0) + (vr ? (vr.right - vr.left) : 1) * (p.x || 0),
									y: (vr ? vr.top : 0) + (vr ? (vr.bottom - vr.top) : 1) * (p.y || 0),
								}));
								for (let j = 1; j < pts.length; j++) {
									const a = pts[j - 1]; const b = pts[j];
									const A = px - a.x; const B = py - a.y; const C = b.x - a.x; const D = b.y - a.y;
									const dot = A * C + B * D; const len_sq = C * C + D * D; let param = -1; if (len_sq !== 0) param = dot / len_sq;
									let xx, yy; if (param < 0) { xx = a.x; yy = a.y; } else if (param > 1) { xx = b.x; yy = b.y; } else { xx = a.x + param * C; yy = a.y + param * D; }
									const dx = px - xx; const dy = py - yy; if (Math.hypot(dx, dy) <= tolerance) return s;
								}
							}
						} catch {}
					}
					return null;
				})();
				if (hit) {
					const idx = shapesRef.current.findIndex(s => s === hit);
					if (idx >= 0) shapesRef.current.splice(idx, 1);
					try {
						const ws = wsRef.current;
						if (ws && ws.readyState === WebSocket.OPEN) {
							ws.send(JSON.stringify({ type: 'eraseShape', channel: channelRef.current, ts: hit.ts }));
						}
					} catch {}
					ctx.clearRect(0, 0, canvasNode.width, canvasNode.height);
					const ctx2 = canvasNode.getContext('2d');
					if (ctx2) {
						// redraw remaining
						const vr = videoRectRef.current;
						if (vr) { ctx2.save(); ctx2.beginPath(); ctx2.rect(vr.left, vr.top, vr.right - vr.left, vr.bottom - vr.top); ctx2.clip(); }
						// reuse renderAll for simplicity
						renderAll(ctx2);
					}
				}
				return;
			}
			const start = clampToVideo(x, y);
			startX = start.x;
			startY = start.y;
			drawing = true;
			if (tool === 'free') {
				freePointsRef.current = [{ x: startX, y: startY }];
			}
		}

		function onMove(e: PointerEvent) {
			const { x, y } = getXY(e);
			const inside = isInsideVideo(x, y);
			setIsInside(inside);
			if (!enabled) return;
			if (tool === 'select') {
				if (!dragging) return
				const dx = x - dragging.startX
				const dy = y - dragging.startY
				const vr = videoRectRef.current
				const vrW = Math.max(1, (vr?.right ?? 0) - (vr?.left ?? 0))
				const vrH = Math.max(1, (vr?.bottom ?? 0) - (vr?.top ?? 0))
				const s = dragging.s
				const base = dragging.base || {}
				if (s.type === 'drawArrow') {
					const x1Abs = (base.x1 ?? 0) + dx
					const y1Abs = (base.y1 ?? 0) + dy
					const x2Abs = (base.x2 ?? 0) + dx
					const y2Abs = (base.y2 ?? 0) + dy
					s.nx1 = (x1Abs - (vr?.left ?? 0)) / vrW
					s.ny1 = (y1Abs - (vr?.top ?? 0)) / vrH
					s.nx2 = (x2Abs - (vr?.left ?? 0)) / vrW
					s.ny2 = (y2Abs - (vr?.top ?? 0)) / vrH
				} else if (s.type === 'drawCircle') {
					const cxAbs = (base.cx ?? 0) + dx
					const cyAbs = (base.cy ?? 0) + dy
					s.cx = (cxAbs - (vr?.left ?? 0)) / vrW
					s.cy = (cyAbs - (vr?.top ?? 0)) / vrH
				} else if (s.type === 'drawRect') {
					const xAbs = (base.x ?? 0) + dx
					const yAbs = (base.y ?? 0) + dy
					s.x = (xAbs - (vr?.left ?? 0)) / vrW
					s.y = (yAbs - (vr?.top ?? 0)) / vrH
				} else if (s.type === 'drawFree') {
					const basePts = base.points || []
					const pts = s.points || []
					for (let i = 0; i < Math.min(basePts.length, pts.length); i++) {
						const px = basePts[i].x + dx
						const py = basePts[i].y + dy
						pts[i].x = (px - (vr?.left ?? 0)) / vrW
						pts[i].y = (py - (vr?.top ?? 0)) / vrH
					}
				}
				const ctx = canvasNode.getContext('2d')
				if (ctx) {
					// live redraw while dragging
					renderAll(ctx)
				}
				sendState()
				return
			}
			if (!drawing) return;
			const ctx = canvasNode.getContext('2d');
			if (!ctx) return;
			// Compute end position and optionally show preview (disabled locally)
			const end = clampToVideo(x, y);
			// Send live preview to draw.html
			try {
				const ws = wsRef.current;
				if (ws && ws.readyState === WebSocket.OPEN && isChannelActiveRef.current) {
					const vr = videoRectRef.current;
					const vrW = Math.max(1, (vr?.right ?? 0) - (vr?.left ?? 0));
					const vrH = Math.max(1, (vr?.bottom ?? 0) - (vr?.top ?? 0));
					if (tool === 'arrow') {
						ws.send(JSON.stringify({
							type: 'previewArrow',
							channel: channelRef.current,
							color,
							lw: 3,
							nx1: vr ? (startX - vr.left) / vrW : 0,
							ny1: vr ? (startY - vr.top) / vrH : 0,
							nx2: vr ? (end.x - vr.left) / vrW : 0,
							ny2: vr ? (end.y - vr.top) / vrH : 0,
						}));
					} else if (tool === 'circle') {
						const r = Math.hypot(end.x - startX, end.y - startY);
						ws.send(JSON.stringify({
							type: 'previewCircle',
							channel: channelRef.current,
							color,
							lw: 3,
							cx: vr ? (startX - vr.left) / vrW : 0,
							cy: vr ? (startY - vr.top) / vrH : 0,
							rx: vr ? r / vrW : 0,
							ry: vr ? r / vrH : 0,
						}));
					} else if (tool === 'rect') {
						const dx = end.x - startX; const dy = end.y - startY;
						const side = Math.max(Math.abs(dx), Math.abs(dy));
						const rx = dx >= 0 ? side : -side; const ry = dy >= 0 ? side : -side;
						const leftPx = Math.min(startX, startX + rx);
						const topPx = Math.min(startY, startY + ry);
						const sizePx = Math.abs(side);
						ws.send(JSON.stringify({
							type: 'previewRect',
							channel: channelRef.current,
							color,
							lw: 3,
							x: vr ? (leftPx - vr.left) / vrW : 0,
							y: vr ? (topPx - vr.top) / vrH : 0,
							w: vr ? sizePx / vrW : 0,
							h: vr ? sizePx / vrH : 0,
						}));
					} else if (tool === 'free') {
						freePointsRef.current.push({ x: end.x, y: end.y });
						const vrNow = videoRectRef.current;
						const vrWNow = Math.max(1, (vrNow?.right ?? 0) - (vrNow?.left ?? 0));
						const vrHNow = Math.max(1, (vrNow?.bottom ?? 0) - (vrNow?.top ?? 0));
						const npoints = freePointsRef.current.map(p => ({ x: vrNow ? (p.x - (vrNow.left)) / vrWNow : 0, y: vrNow ? (p.y - (vrNow.top)) / vrHNow : 0 }));
						ws.send(JSON.stringify({ type: 'previewFree', channel: channelRef.current, color, lw: 3, points: npoints }));
					}
				}
			} catch {}
			if (SHOW_LOCAL_PREVIEW) {
				// Redraw existing shapes, then preview current stroke
				renderAll(ctx);
				const vr = videoRectRef.current;
				if (vr) { ctx.save(); ctx.beginPath(); ctx.rect(vr.left, vr.top, vr.right - vr.left, vr.bottom - vr.top); ctx.clip(); }
				if (tool === 'arrow') {
					drawArrow(ctx, startX, startY, end.x, end.y);
				} else if (tool === 'circle') {
					drawCircleFromCenter(ctx, startX, startY, end.x, end.y);
				} else if (tool === 'rect') {
					drawSquareFromStart(ctx, startX, startY, end.x, end.y);
				} else if (tool === 'free') {
					freePointsRef.current.push({ x: end.x, y: end.y });
					drawFreePath(ctx, freePointsRef.current);
				}
				if (vr) ctx.restore();
			} else {
				if (tool === 'free') {
					freePointsRef.current.push({ x: end.x, y: end.y });
				}
			}
		}

		function onUp(e: PointerEvent) {
			// Finish drag in select mode first
			if (tool === ('select' as any)) {
				try { canvasNode.releasePointerCapture(e.pointerId) } catch {}
				dragging = null
				const ctxEnd = canvasNode.getContext('2d')
				if (ctxEnd) renderAll(ctxEnd)
				sendState()
				return
			}
			if (!drawing) return;
			const { x, y } = getXY(e);
			const ctx = canvasNode.getContext('2d');
			if (!ctx) return;
			// Finalize stroke (no local drawing)
			const end = clampToVideo(x, y);
			if (SHOW_LOCAL_PREVIEW) {
				const vr = videoRectRef.current;
				if (vr) { ctx.save(); ctx.beginPath(); ctx.rect(vr.left, vr.top, vr.right - vr.left, vr.bottom - vr.top); ctx.clip(); }
				if (tool === 'arrow') {
					drawArrow(ctx, startX, startY, end.x, end.y);
				} else if (tool === 'circle') {
					drawCircleFromCenter(ctx, startX, startY, end.x, end.y);
				} else if (tool === 'rect') {
					drawSquareFromStart(ctx, startX, startY, end.x, end.y);
				} else if (tool === 'free') {
					freePointsRef.current.push({ x: end.x, y: end.y });
					drawFreePath(ctx, freePointsRef.current);
				}
				if (vr) ctx.restore();
			} else {
				if (tool === 'free') {
					freePointsRef.current.push({ x: end.x, y: end.y });
				}
			}
			// End move in select mode (no-op here since select mode doesn't draw)
			if (tool as any === 'select') {
				drawing = false
				dragging = null
				try { canvasNode.releasePointerCapture(e.pointerId) } catch {}
				return
			}
			drawing = false;
			try { canvasNode.releasePointerCapture(e.pointerId); } catch {}
			// Broadcast to overlay preview via overlay_ws
			try {
				const ws = wsRef.current;
				if (ws && ws.readyState === WebSocket.OPEN) {
					if (!isChannelActiveRef.current) {
						// Not in single_channel-1..4 → do not broadcast
						return;
					}
					// Clear preview first
					try { ws.send(JSON.stringify({ type: 'clearPreview', channel: channelRef.current })); } catch {}
					const vrNow = videoRectRef.current;
					const vrW = Math.max(1, (vrNow?.right ?? 0) - (vrNow?.left ?? 0));
					const vrH = Math.max(1, (vrNow?.bottom ?? 0) - (vrNow?.top ?? 0));
					if (tool === 'arrow') {
						const nx1 = vrNow ? (startX - vrNow.left) / vrW : 0;
						const ny1 = vrNow ? (startY - vrNow.top) / vrH : 0;
						const nx2 = vrNow ? (end.x - vrNow.left) / vrW : 0;
						const ny2 = vrNow ? (end.y - vrNow.top) / vrH : 0;
						const payload = {
							type: 'drawArrow',
							channel: channelRef.current,
							normalized: true,
							nx1,
							ny1,
							nx2,
							ny2,
							ts: Date.now(),
							color,
							lw: 3,
						};
						ws.send(JSON.stringify(payload));
						shapesRef.current.push(payload);
					} else if (tool === 'circle') {
						const r = Math.hypot(end.x - startX, end.y - startY);
						const payload = {
							type: 'drawCircle',
							channel: channelRef.current,
							normalized: true,
							cx: vrNow ? (startX - vrNow.left) / vrW : 0,
							cy: vrNow ? (startY - vrNow.top) / vrH : 0,
							rx: vrNow ? r / vrW : 0,
							ry: vrNow ? r / vrH : 0,
							ts: Date.now(),
							color,
							lw: 3,
						};
						ws.send(JSON.stringify(payload));
						shapesRef.current.push(payload);
					} else if (tool === 'rect') {
						const dx = end.x - startX;
						const dy = end.y - startY;
						const side = Math.max(Math.abs(dx), Math.abs(dy));
						const rx = dx >= 0 ? side : -side;
						const ry = dy >= 0 ? side : -side;
						const leftPx = Math.min(startX, startX + rx);
						const topPx = Math.min(startY, startY + ry);
						const sizePx = Math.abs(side);
						const payload = {
							type: 'drawRect',
							channel: channelRef.current,
							normalized: true,
							x: vrNow ? (leftPx - vrNow.left) / vrW : 0,
							y: vrNow ? (topPx - vrNow.top) / vrH : 0,
							w: vrNow ? sizePx / vrW : 0,
							h: vrNow ? sizePx / vrH : 0,
							ts: Date.now(),
							color,
							lw: 3,
						};
						ws.send(JSON.stringify(payload));
						shapesRef.current.push(payload);
					} else if (tool === 'free') {
						const points = freePointsRef.current;
						const npoints = points.map(p => ({ x: vrNow ? (p.x - (vrNow.left)) / vrW : 0, y: vrNow ? (p.y - (vrNow.top)) / vrH : 0 }));
						const payload = {
							type: 'drawFree',
							channel: channelRef.current,
							normalized: true,
							points: npoints,
							ts: Date.now(),
							color,
							lw: 3,
						};
						ws.send(JSON.stringify(payload));
						shapesRef.current.push(payload);
					}
				}
			} catch {}
			sendState()
			// Redraw to include the new shape
			const ctx2 = canvasNode.getContext('2d');
			if (ctx2) renderAll(ctx2);
		}

		canvasNode.addEventListener('pointerdown', onDown);
		canvasNode.addEventListener('pointermove', onMove);
		canvasNode.addEventListener('pointerup', onUp);
		canvasNode.addEventListener('pointerleave', onUp);
		return () => {
			canvasNode.removeEventListener('pointerdown', onDown);
			canvasNode.removeEventListener('pointermove', onMove);
			canvasNode.removeEventListener('pointerup', onUp);
			canvasNode.removeEventListener('pointerleave', onUp);
		};
	}, [enabled, ready, tool, color]);

	function clearAllDrawings() {
		try {
			const ch = channelRef.current;
			shapesRef.current = shapesRef.current.filter(s => s.channel !== ch);
			const ws = wsRef.current;
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'clearAll', channel: ch, ts: Date.now() }));
			}
			const canvasNode = canvasRef.current as HTMLCanvasElement | null;
			const ctx = canvasNode?.getContext('2d') || null;
			if (canvasNode && ctx) {
				ctx.save();
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.clearRect(0, 0, canvasNode.width, canvasNode.height);
				ctx.restore();
				renderAll(ctx);
			}
		} catch {}
		setMenuPos(null);
	}

	function deleteSelectedDrawing() {
		try {
			const sel = selectedRef.current
			if (!sel) { setMenuPos(null); return }
			const idx = shapesRef.current.findIndex(s => s === sel || (s && sel && s.ts === sel.ts && s.channel === sel.channel))
			if (idx >= 0) {
				const removed = shapesRef.current.splice(idx, 1)[0]
				try {
					const ws = wsRef.current
					if (ws && ws.readyState === WebSocket.OPEN && removed?.ts != null) {
						ws.send(JSON.stringify({ type: 'eraseShape', channel: removed.channel ?? channelRef.current, ts: removed.ts }))
					}
				} catch {}
			}
			selectedRef.current = null
			const canvasNode = canvasRef.current as HTMLCanvasElement | null
			const ctx = canvasNode?.getContext('2d') || null
			if (canvasNode && ctx) renderAll(ctx)
		} catch {}
		setMenuPos(null)
	}

	// Allow external UI to set the current drawing tool
	useEffect(() => {
		function onSetTool(e: any) {
			try {
				const t = String(e?.detail?.tool || '').toLowerCase();
				if (t === 'select' || t === 'arrow' || t === 'circle' || t === 'free' || t === 'rect' || t === 'eraser') {
					setTool(t as 'arrow' | 'circle' | 'free' | 'rect' | 'eraser');
					// selecting a tool clears the current selection unless it's select
					if (t !== 'select') selectedRef.current = null
				} else if (t === 'square' || t === 'rectangle') {
					setTool('rect');
				}
			} catch {}
		}
		function onSetColor(e: any) {
			try {
				const c = e?.detail?.color;
				if (typeof c === 'string' && c.trim()) setColor(c);
			} catch {}
		}
		function onSetChannel(e: any) {
			try {
				const ch = Number(e?.detail?.channel);
				if (Number.isFinite(ch) && ch >= 1 && ch <= 4) {
					channelRef.current = ch;
					isChannelActiveRef.current = true;
					// push current channel shapes to overlay
					const ws = wsRef.current;
					if (ws && ws.readyState === WebSocket.OPEN) {
						const items = shapesRef.current.filter(s => s.channel === channelRef.current);
						if (items.length) ws.send(JSON.stringify({ type: 'bulkSync', channel: channelRef.current, items, ts: Date.now() }));
					}
				}
			} catch {}
		}
		window.addEventListener('app:set-draw-tool', onSetTool as any);
		window.addEventListener('app:set-draw-color', onSetColor as any);
		window.addEventListener('app:set-draw-channel', onSetChannel as any);
		return () => {
			window.removeEventListener('app:set-draw-tool', onSetTool as any);
			window.removeEventListener('app:set-draw-color', onSetColor as any);
			window.removeEventListener('app:set-draw-channel', onSetChannel as any);
		}
	}, []);

	// Clear canvas whenever drawing gets disabled
	useEffect(() => {
		const wasEnabled = prevEnabledRef.current;
		if (wasEnabled && !enabled) {
			const canvasNode = canvasRef.current as HTMLCanvasElement | null;
			if (canvasNode) {
				const ctx = canvasNode.getContext('2d');
				if (ctx) {
					ctx.save();
					ctx.setTransform(1, 0, 0, 1, 0, 0);
					ctx.clearRect(0, 0, canvasNode.width, canvasNode.height);
					ctx.restore();
				}
			}
		}
		prevEnabledRef.current = enabled;
	}, [enabled]);

	function disableDrawMode() {
		try {
			onRequestDisable?.();
			window.dispatchEvent(new CustomEvent('app:draw-overlay-changed', { detail: { enabled: false } }));
		} catch {}
	}

	const vr = viewportRect;
	const holeLeft = vr?.left ?? 0;
	const holeTop = vr?.top ?? 0;
	const holeRight = vr?.right ?? 0;
	const holeBottom = vr?.bottom ?? 0;

	return (
		<>
			{/* Outside click blockers removed: edit mode should persist until explicitly disabled. */}

			<div ref={wrapperRef} className="absolute inset-0" style={{ zIndex: 5000, pointerEvents: enabled ? 'auto' : 'none' }}>
				<canvas
					ref={canvasRef}
					onContextMenu={(e) => {
						e.preventDefault();
						setMenuPos({ x: e.clientX, y: e.clientY });
					}}
					onPointerMove={(e) => {
						const node = canvasRef.current;
						if (!node) return;
						const rect = node.getBoundingClientRect();
						const x = e.clientX - rect.left;
						const y = e.clientY - rect.top;
						setIsInside(isInsideVideo(x, y));
					}}
					style={{
						width: '100%',
						height: '100%',
						pointerEvents: enabled ? 'auto' : 'none',
						cursor: enabled ? (tool === 'select' ? 'default' : (isInside ? 'crosshair' : 'pointer')) : 'default',
					}}
				/>
				{menuPos && (
					<div
						ref={menuRef}
						className="fixed bg-[#1f2937] text-white text-sm shadow-lg rounded py-1"
						style={{ left: menuPos.x, top: menuPos.y, zIndex: 6000, minWidth: 160 }}
					>
						{selectedRef.current ? (
							<button
								className="w-full text-left px-3 py-2 hover:bg-[#374151]"
								onClick={() => deleteSelectedDrawing()}
							>
								Delete item
							</button>
						) : null}
						<button
							className="w-full text-left px-3 py-2 hover:bg-[#374151]"
							onClick={() => clearAllDrawings()}
						>
							Clear all drawings
						</button>
					</div>
				)}
			</div>


		</>
	);
}