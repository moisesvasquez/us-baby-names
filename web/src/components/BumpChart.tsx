import { useLayoutEffect, useRef, useState } from 'react'
import { fmt } from '../lib/format'

interface Row { name: string; ranks: (number | null)[]; counts: number[] }

/**
 * Rank-over-time chart for the top names. Lines are neutral; the selected name (tap/hover) and #1 carry the accent.
 * Drawn at the container's real pixel width so labels stay readable on phones.
 */
export function BumpChart({ rows, years, accent, onPick }: { rows: Row[]; years: number[]; accent: string; onPick?: (n: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(520)
  const [hover, setHover] = useState<string | null>(null)
  const last = years.length - 1
  const leader = rows.find((r) => r.ranks[last] === 1)?.name ?? null
  const [selected, setSelected] = useState<string | null>(leader)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  const narrow = width < 440
  const maxRank = 12
  const fs = narrow ? 12 : 13
  const W = width, H = narrow ? 340 : 380, L = narrow ? 82 : 96, R = narrow ? 92 : 112, T = 16, B = 28
  const x = (i: number) => L + (i * (W - L - R)) / (years.length - 1)
  const y = (r: number) => T + ((Math.min(r, maxRank + 1) - 1) * (H - T - B)) / maxRank
  const focus = hover ?? selected ?? leader
  const active = (n: string) => n === focus
  const ordered = [...rows].sort((a, b) => Number(active(a.name)) - Number(active(b.name)))
  const focusRow = rows.find((r) => r.name === focus)

  return (
    <div ref={ref}>
      <svg width={W} height={H} role="img" aria-label="Rank of top names by year" style={{ overflow: 'visible', display: 'block' }}>
        {years.map((yr, i) => (
          <g key={yr}>
            <line x1={x(i)} x2={x(i)} y1={T - 6} y2={H - B + 4} stroke="var(--grid)" />
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--muted)">{narrow ? `’${String(yr).slice(2)}` : yr}</text>
          </g>
        ))}
        <text x={x(0) - 10} y={y(maxRank + 1) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">below #{maxRank}</text>
        {ordered.map((r) => {
          const on = active(r.name)
          const pts = r.ranks.map((rk, i) => [x(i), y(rk ?? maxRank + 1)] as const)
          const color = on ? accent : 'var(--neutral-line)'
          const first = r.ranks[0], end = r.ranks[last]
          const line = pts.map((p) => p.join(',')).join(' ')
          return (
            <g key={r.name} onMouseEnter={() => setHover(r.name)} onMouseLeave={() => setHover(null)}
              onClick={() => setSelected(r.name)} style={{ cursor: 'pointer' }}>
              <polyline points={line} fill="none" stroke="transparent" strokeWidth={18} />
              <polyline points={line} fill="none" stroke={color} strokeWidth={on ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map(([px, py], i) => (r.ranks[i] && r.ranks[i]! <= maxRank) ? (
                <circle key={i} cx={px} cy={py} r={on ? 5 : 4} fill={color} stroke="var(--page)" strokeWidth={2} />
              ) : null)}
              {first && first <= maxRank && (
                <text x={x(0) - 12} y={y(first) + 4} textAnchor="end" fontSize={fs} fill={on ? 'var(--ink)' : 'var(--ink-2)'} fontWeight={on ? 600 : 400}>{r.name} {first}</text>
              )}
              {end && end <= maxRank && (
                <text x={x(last) + 12} y={y(end) + 4} fontSize={fs} fill={on ? 'var(--ink)' : 'var(--ink-2)'} fontWeight={on ? 600 : 400}>{end} {r.name}</text>
              )}
            </g>
          )
        })}
      </svg>
      {focusRow && (
        <div className="bump-detail">
          <span>
            <b>{focusRow.name}</b>{' '}
            {focusRow.ranks.map((rk, i) => `${years[i]}: ${rk ? '#' + rk : '—'}`).join(' · ')}
            <span className="note"> · {fmt(focusRow.counts[last])} babies in {years[last]}</span>
          </span>
          {onPick && <button className="link-btn" onClick={() => onPick(focusRow.name)}>Explore {focusRow.name} →</button>}
        </div>
      )}
    </div>
  )
}
