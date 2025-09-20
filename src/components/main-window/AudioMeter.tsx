import { cn } from "@/lib/utils"

export type AudioMeterProps = {
  valueDb: number | null
  minDb?: number
  maxDb?: number
  numSegments?: number
  className?: string
}

export function AudioMeter({
  valueDb,
  minDb = -60,
  maxDb = 0,
  numSegments = 24,
  className,
}: AudioMeterProps) {
  const clamped = valueDb === null ? minDb : Math.max(minDb, Math.min(maxDb, valueDb))

  const segmentDbAtIndex = (i: number) => minDb + ((i + 1) / numSegments) * (maxDb - minDb)
  const isSegmentActive = (i: number) => clamped >= segmentDbAtIndex(i)
  const colorForDb = (dbVal: number) => {
    if (dbVal >= -9) return '#EF4444' // red
    if (dbVal >= -20) return '#F59E0B' // yellow
    return '#22C55E' // green
  }

  return (
    <div
      className={cn(
        "w-56 h-4 flex items-center gap-[3px] px-[2px] bg-[#1b1f26] border border-black/40 rounded",
        className,
      )}
      title={valueDb === null ? 'No signal' : `${clamped.toFixed(2)} dB`}
    >
      {Array.from({ length: numSegments }).map((_, i) => {
        const segDb = segmentDbAtIndex(i)
        const isOn = isSegmentActive(i)
        const color = colorForDb(segDb)
        return (
          <div
            key={i}
            className="h-[12px] flex-1 rounded-[2px] border border-black/50 transition-colors"
            style={{
              backgroundColor: isOn ? color : 'rgba(0,0,0,0.35)',
              boxShadow: isOn ? `0 0 6px ${color}55 inset, 0 0 4px ${color}55` : 'inset 0 0 4px rgba(0,0,0,0.4)',
            }}
          />
        )
      })}
    </div>
  )
}

export default AudioMeter


