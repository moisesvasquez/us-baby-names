import type { ReactNode } from 'react'
import type { Summary } from '../lib/stats'
import { pct } from '../lib/format'

export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  )
}

export function TrendBadge({ trend }: { trend: Summary['trend'] }) {
  const cls = trend.label === 'Rising' || trend.label === 'New' ? 'up' : trend.label === 'Falling' || trend.label === 'Gone' ? 'down' : ''
  const arrow = cls === 'up' ? '↑' : cls === 'down' ? '↓' : '→'
  return (
    <span className={'badge ' + cls}>
      {arrow} {trend.label}{trend.pct != null ? ` ${pct(trend.pct)}` : ''}
    </span>
  )
}
