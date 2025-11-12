import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
/**
 * ROV Heading Compass (ASCII-safe)
 * - Kompas beranimasi menggunakan Framer Motion.
 * - Kod ini mengelakkan aksara Unicode dalam string/JSX untuk elak \uXXXX parse errors.
 * - Gantikan simbol darjah (degree) dengan \u00B0, dan buang aksara bukan ASCII dalam komen/label.
 *
 * Cara guna:
 *   <ROVHeadingCompass size={420} />
 */
export default function ROVHeadingCompass({ size = 300, heading }: { size?: number; heading?: number }) {
  const [localHeading, setLocalHeading] = useState(0); // semasa (deg) when simulating
  const [playing] = useState(true);
  const [speed] = useState(8); // deg/s perlahan untuk random wander
  const controls = useAnimation();
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  // keep a continuous, unwrapped angle for smooth ring rotation
  const lastHeadingRef = useRef(0);
  const contAngleRef = useRef(0); // in degrees (can grow beyond 360)
  const headingRef = useRef(0); // for RAF loop without re-subscribing
  const simTargetRef = useRef(0); // heading sasaran semasa (random walk)
  const retargetAtRef = useRef(0); // timestamp ms bila perlu pilih sasaran baru

  // Ring radius & layout
  const BASE = 420;
  const scale = size / BASE;
  const s = (n: number) => n * scale;

  const R = size / 2;
  const ringOuter = R - s(8); // margin
  const ringInner = ringOuter - s(56); // ketebalan ring label
  // Place tick marks right on the outer circumference, drawing inward
  const tickOuter = ringOuter;
  const tickInnerMajor = ringOuter - s(18);
  const tickInnerMinor = ringOuter - s(10);

  // Utility: degree -> radian
  const toRad = (d: number) => (d * Math.PI) / 180;
  // Normalize angle to [0, 360)
  const norm = (v: number) => ((v % 360) + 360) % 360;

  // SVG helpers
  const polar = (radius: number, deg: number) => {
    const rad = toRad(deg - 90); // 0 deg di atas
    return [R + radius * Math.cos(rad), R + radius * Math.sin(rad)];
  };

  // Precompute ticks & labels
  const ticks = useMemo(() => {
    const arr = [];
    for (let d = 0; d < 360; d += 5) {
      const [x1, y1] = polar(tickOuter, d);
      const [x2, y2] = polar(d % 10 === 0 ? tickInnerMajor : tickInnerMinor, d);
      arr.push({ d, x1, y1, x2, y2, major: d % 10 === 0 });
    }
    return arr;
  }, [tickOuter, tickInnerMajor, tickInnerMinor]);

  // Numeral labels removed as requested

  const cardinal = useMemo(
    () => [
      { d: 0, label: "N" },
      { d: 90, label: "E" },
      { d: 180, label: "S" },
      { d: 270, label: "W" },
    ].map((c) => ({ ...c, pos: polar(ringInner + 6, c.d) })),
    [ringInner]
  );

  // Source of truth for current heading: external prop if provided, otherwise local simulation state
  const activeHeading = typeof heading === 'number' ? heading : localHeading;

  // Keep refs in sync with activeHeading
  useEffect(() => {
    headingRef.current = activeHeading;
  }, [activeHeading]);

  // Animate rotating ring using unwrapped angle to avoid back-forth near 0/360
  useEffect(() => {
    // compute shortest delta from last heading to new heading
    const prev = lastHeadingRef.current;
    let diff = ((activeHeading - prev + 540) % 360) - 180; // [-180,180)
    contAngleRef.current = contAngleRef.current + diff;
    lastHeadingRef.current = activeHeading;

    controls.start({
      rotate: -contAngleRef.current,
      transition: { type: "spring", stiffness: 60, damping: 18 },
    });
  }, [activeHeading, controls]);

  // Simulation loop: slow random walk (retarget every few seconds) — only when heading prop is not supplied
  useEffect(() => {
    if (typeof heading === 'number') return; // external control; skip simulation
    const step = (ts: number) => {
      const last = lastTsRef.current || ts;
      const dt = (ts - last) / 1000;
      lastTsRef.current = ts;

      if (playing) {
        // retarget to a nearby random heading every ~0.5–1s
        if (ts >= retargetAtRef.current) {
          const hNow = headingRef.current;
          const jitter = (Math.random() * 50 - 25); // +/-25 deg window
          simTargetRef.current = norm(hNow + jitter);
          retargetAtRef.current = ts + 500 + Math.random() * 500;
        }
        const target = simTargetRef.current;
        // shortest angular distance from current heading to target
        const h = headingRef.current;
        let diff = ((target - h + 540) % 360) - 180;
        const maxStep = speed * dt;
        let delta = Math.max(-maxStep, Math.min(maxStep, diff));
        let next = (h + delta + 360) % 360;
        // tiny noise for life
        next = norm(next + (Math.random() - 0.5) * 0.02);
        headingRef.current = next;
        setLocalHeading(next);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speed, heading]);

  // Helpers

  // No numeric readout per request

  return (
    <div className="w-fit flex flex-col items-center gap-6 p-2 bg-[#21262E] border-r border-slate-700">
      <div
        style={{ width: size, height: size }}
        className="relative rounded-full bg-slate-900 shadow-2xl ring-1 ring-slate-800"
      >
        {/* Center cleared of numbers per request */}

        {/* RING berputar menentang heading */}
        <motion.div
          className="absolute inset-0"
          animate={controls}
          style={{ transformOrigin: "50% 50%" }}
        >
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Outer ring */}
            <circle cx={R} cy={R} r={ringOuter} fill="none" stroke="#0f172a" strokeWidth={s(10)} />

            {/* Tick marks */}
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.major ? "#94a3b8" : "#334155"}
                strokeWidth={t.major ? s(2) : s(1)}
                strokeLinecap="round"
              />
            ))}

            {/* Numerals removed */}

            {/* Cardinal directions */}
            {cardinal.map((c, i) => (
              <text
                key={i}
                x={c.pos[0]}
                y={c.pos[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={c.label === "N" || c.label === "W" ? s(28) : s(24)}
                fill={c.label === "N" || c.label === "E" ? "#f87171" : "#e2e8f0"}
                fontWeight={700}
                className="select-none tracking-wider"
                transform={`rotate(${contAngleRef.current}, ${c.pos[0]}, ${c.pos[1]})`}
              >
                {c.label}
              </text>
            ))}

            {/* Inner ring border */}
            <circle cx={R} cy={R} r={ringInner} fill="none" stroke="#0f172a" strokeWidth={s(2)} />
          </svg>
        </motion.div>

        {/* Fixed top marker (lubber line) */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 rounded bg-cyan-400 shadow" style={{ height: s(24), width: s(4) }} />
      </div>

      {/* Readout (similar style to DepthRollingGraph ValuePill) */}
      <div className="w-full relative top-[2px]">
        <div className="flex items-center justify-between rounded-2xl px-2 py-1 border border-zinc-800 bg-zinc-950/60 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#f87171" }} />
            <span className="text-zinc-300">Heading</span>
          </div>
          <span className="tabular-nums font-medium">
            {activeHeading.toFixed(2)}\u00B0
          </span>
        </div>
      </div>

      {/* Controls removed as requested */}
    </div>
  );
}
