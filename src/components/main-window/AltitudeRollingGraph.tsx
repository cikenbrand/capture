// AltitudeRollingGraph.tsx
import { useState, useImperativeHandle, forwardRef, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Chart from "chart.js/auto";

export type AltitudeSample = { alt: number; ts?: number };

export type AltitudeRollingGraphProps = {
  windowSeconds?: number;
  minY?: number;
  maxY?: number;
  color?: string;
  fill?: boolean;
  units?: string;
  targetAlt?: number;
};

export type AltitudeRollingGraphRef = {
  push: (sample: AltitudeSample) => void;
  clear: () => void;
  setPaused: (paused: boolean) => void;
};

const DEFAULT_COLOR = "#22c55e";

const AltitudeRollingGraph = forwardRef<AltitudeRollingGraphRef, AltitudeRollingGraphProps>(
  (
    {
      windowSeconds = 60,
      minY,
      maxY,
      color = DEFAULT_COLOR,
      fill = true,
      units = "m",
      targetAlt,
    },
    ref
  ) => {
    const [paused, setPaused] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<Chart | null>(null);
    const dataRef = useRef<Array<{ x: number; y: number }>>([]);
    const [lastAlt, setLastAlt] = useState<number | undefined>(undefined);

    useEffect(() => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const chart = new Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Altitude",
              data: dataRef.current,
              borderColor: color,
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.2,
              parsing: false,
              fill: fill ? "start" : false,
              backgroundColor: fill ? `${color}33` : undefined,
            },
            ...(typeof targetAlt === "number"
              ? [
                  {
                    label: "Target",
                    data: [
                      { x: Date.now() - windowSeconds * 1000, y: targetAlt },
                      { x: Date.now(), y: targetAlt },
                    ],
                    borderColor: "#f43f5e",
                    borderWidth: 1.5,
                    pointRadius: 0,
                    borderDash: [6, 6],
                    parsing: false,
                  } as any,
                ]
              : []),
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          // ❌ Disable interactions/hover
          events: [],
          interaction: { intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }, // ❌ Disable tooltip
          },
          scales: {
            x: {
              type: "linear",
              min: Date.now() - windowSeconds * 1000,
              max: Date.now(),
              ticks: {
                color: "#d4d4d8",
                font: { size: 10 },
                callback: (value) =>
                  new Date(Number(value)).toLocaleTimeString([], {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }),
              },
              grid: { color: "#27272a" },
            },
            y: {
              min: typeof minY === "number" ? minY : undefined,
              max: typeof maxY === "number" ? maxY : undefined,
              ticks: {
                color: "#d4d4d8",
                font: { size: 10 },
                callback: (v) => `${Number(v).toFixed(2)} ${units}`,
              },
              grid: { color: "#3f3f46" },
            },
          },
        },
      });

      chartRef.current = chart;
      return () => {
        chart.destroy();
        chartRef.current = null;
      };
    }, []);

    const applyTrimAndUpdate = (ts: number) => {
      const cutoff = ts - windowSeconds * 1000;
      const arr = dataRef.current;
      while (arr.length && arr[0].x < cutoff) arr.shift();

      const chart = chartRef.current;
      if (!chart) return;

      chart.options.scales!.x!.min = cutoff;
      chart.options.scales!.x!.max = ts;

      if (typeof minY !== "number" || typeof maxY !== "number") {
        let lo = Infinity;
        let hi = -Infinity;
        for (const p of arr) {
          if (p.y < lo) lo = p.y;
          if (p.y > hi) hi = p.y;
        }
        if (!isFinite(lo) || !isFinite(hi)) {
          lo = 0;
          hi = 1;
        }
        const pad = Math.max(0.1 * Math.abs(hi - lo), 0.5);
        (chart.options.scales!.y as any).min = lo - pad;
        (chart.options.scales!.y as any).max = hi + pad;
      } else {
        (chart.options.scales!.y as any).min = minY;
        (chart.options.scales!.y as any).max = maxY;
      }

      if (typeof targetAlt === "number" && chart.data.datasets.length > 1) {
        const ds = chart.data.datasets[1];
        (ds.data as any) = [
          { x: cutoff, y: targetAlt },
          { x: ts, y: targetAlt },
        ];
      }

      chart.update("none");
    };

    const push = (sample: AltitudeSample) => {
      if (paused) return;
      const ts = sample.ts ?? Date.now();
      dataRef.current.push({ x: ts, y: sample.alt });
      setLastAlt(sample.alt);
      applyTrimAndUpdate(ts);
    };

    const clear = () => {
      dataRef.current = [];
      setLastAlt(undefined);
      chartRef.current?.update("none");
    };

    useImperativeHandle(ref, () => ({ push, clear, setPaused }));

    return (
      <div className="w-[400px] h-full bg-[#21262E] text-zinc-100 border-r border-slate-700">
        <div className="p-2">
          <div className="h-50">
            <div className="w-full h-full">
              <canvas ref={canvasRef} className="w-full h-full" />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-2 text-xs" // 🔽 kecilkan teks
          >
            <ValuePill label="Altitude" value={lastAlt} units={units} color={color} />
          </motion.div>
        </div>
      </div>
    );
  }
);

function ValuePill({
  label,
  value,
  units,
  color,
}: {
  label: string;
  value?: number;
  units?: string;
  color: string;
}) {
  const text =
    value !== undefined
      ? `${value.toFixed(2)}${units ? ` ${units}` : ""}`
      : "--";
  return (
    <div className="flex items-center justify-between rounded-2xl px-2 py-1 border border-zinc-800 bg-zinc-950/60 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-zinc-300">{label}</span>
      </div>
      <span className="tabular-nums font-medium">{text}</span>
    </div>
  );
}

export default AltitudeRollingGraph;
