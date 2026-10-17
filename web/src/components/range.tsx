import { useEffect, useState } from 'react'

/**
 * State for a Recharts <Brush> zoom slicer: a [start, end] index window over the chart data.
 * Resets to the full range whenever the data length (or `resetKey`) changes.
 */
export function useRange(length: number, resetKey?: unknown) {
  const [range, setRange] = useState<[number, number]>([0, Math.max(0, length - 1)])
  useEffect(() => { setRange([0, Math.max(0, length - 1)]) }, [length, resetKey])
  const [start, end] = range
  return {
    start: Math.min(start, Math.max(0, length - 1)),
    end: Math.min(end, Math.max(0, length - 1)),
    zoomed: start > 0 || end < length - 1,
    set: (s: number, e: number) => setRange([s, e]),
    reset: () => setRange([0, Math.max(0, length - 1)]),
  }
}

export type Range = ReturnType<typeof useRange>

/** Shared props for <Brush>: spread them in and the slicer is styled and controlled. */
export function brushProps(r: Range, dataKey: string, format: (v: number) => string = String) {
  return {
    dataKey,
    startIndex: r.start,
    endIndex: r.end,
    onChange: (e: { startIndex?: number; endIndex?: number }) => {
      if (e.startIndex != null && e.endIndex != null) r.set(e.startIndex, e.endIndex)
    },
    height: 34,
    travellerWidth: 14,
    gap: 1,
    stroke: 'var(--axis)',
    fill: 'var(--chip)',
    tickFormatter: (v: number) => format(v),
    traveller: Handle,
    className: 'brush',
  }
}

function Handle(props: { x?: number; y?: number; width?: number; height?: number }) {
  const { x = 0, y = 0, width = 14, height = 34 } = props
  const cx = x + width / 2
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill="var(--ink)" />
      <line x1={cx - 2} x2={cx - 2} y1={y + height / 2 - 6} y2={y + height / 2 + 6} stroke="var(--page)" strokeWidth={1.5} />
      <line x1={cx + 2} x2={cx + 2} y1={y + height / 2 - 6} y2={y + height / 2 + 6} stroke="var(--page)" strokeWidth={1.5} />
    </g>
  )
}

/** "1950–2025 · Reset" line shown above a zoomable chart. */
export function RangeLabel({ r, from, to, unit = '' }: { r: Range; from: number | string; to: number | string; unit?: string }) {
  return (
    <div className="range-label">
      <span>{unit}{from}–{to}</span>
      {r.zoomed
        ? <button className="link-btn" onClick={r.reset}>Reset zoom</button>
        : <span className="note">Drag the handles below the chart to zoom</span>}
    </div>
  )
}
