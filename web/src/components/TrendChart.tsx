import {
  Brush, CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { compact, fmt } from '../lib/format'
import { useMobile } from '../lib/useMobile'
import { brushProps, RangeLabel, useRange } from './range'

export type Metric = 'count' | 'perMillion' | 'rank'
export interface SeriesDef { key: string; label: string; color: string }
export interface Marker { key: string; year: number; value: number; label: string; color: string }

interface Props {
  data: Record<string, number | null>[]
  series: SeriesDef[]
  metric: Metric
  markers?: Marker[]
  eventYear?: number
  height?: number
  compactAxis?: boolean
}

const metricLabel: Record<Metric, string> = { count: 'babies', perMillion: 'per million births', rank: 'rank' }

function formatValue(v: number, metric: Metric) {
  if (metric === 'rank') return '#' + fmt(v)
  if (metric === 'perMillion') return v >= 100 ? fmt(v) : v.toFixed(1)
  return fmt(v)
}

export function TrendChart({ data, series, metric, markers = [], eventYear, height = 360, compactAxis }: Props) {
  const isRank = metric === 'rank'
  const mobile = useMobile()
  const range = useRange(data.length)
  const visible = data.slice(range.start, range.end + 1)
  const h = mobile ? Math.min(height, 300) : height
  return (
    <div>
      {data.length > 0 && <RangeLabel r={range} from={data[range.start].year as number} to={data[range.end].year as number} />}
    <div style={{ width: '100%', height: h + 44 }} className="zoom-chart">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 22, right: mobile ? 14 : 28, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="year" type="number" domain={['dataMin', 'dataMax']} tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--muted)', fontSize: 12 }}
            ticks={yearTicks(visible, compactAxis || mobile)} allowDecimals={false}
          />
          <YAxis
            reversed={isRank} scale={isRank ? 'log' : 'auto'} domain={isRank ? [1, 'dataMax'] : [0, 'auto']}
            allowDataOverflow={false} tickLine={false} axisLine={false} width={compactAxis || mobile ? 40 : 52}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            tickFormatter={(v: number) => (isRank ? '#' + compact(v) : compact(v))}
            ticks={isRank ? [1, 10, 100, 1000, 10000].filter((t) => t <= maxOf(data, series)) : undefined}
          />
          {eventYear && <ReferenceLine x={eventYear} stroke="var(--ink-2)" strokeDasharray="3 3" />}
          <Tooltip
            cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const rows = [...payload].filter((p) => p.value != null)
              return (
                <div className="tt">
                  <div className="y">{label}</div>
                  {rows.length === 0 && <div className="row"><span>Not in data</span></div>}
                  {rows.map((p) => (
                    <div className="row" key={String(p.dataKey)}>
                      <span><i className="line-key" style={{ background: p.color }} />{series.length > 1 ? p.name : metricLabel[metric]}</span>
                      <span className="num">{formatValue(Number(p.value), metric)}</span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          {series.map((s) => (
            <Line
              key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false}
              connectNulls={false} strokeLinejoin="round" strokeLinecap="round"
            />
          ))}
          {markers.map((m) => (
            <ReferenceDot
              key={m.key + m.year} x={m.year} y={m.value} r={5} fill={m.color} stroke="var(--surface)" strokeWidth={2}
              ifOverflow="discard" label={{ value: m.label, position: 'top', fill: 'var(--ink)', fontSize: 12, fontWeight: 600, offset: 8 }}
            />
          ))}
          <Brush {...brushProps(range, 'year')} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    </div>
  )
}

function maxOf(data: Record<string, number | null>[], series: SeriesDef[]) {
  let m = 1
  for (const row of data) for (const s of series) { const v = row[s.key]; if (v != null && v > m) m = v }
  return m * 10
}

export function yearTicks(data: Record<string, number | null>[], compactAxis?: boolean) {
  if (!data.length) return undefined
  const a = data[0].year as number, b = data[data.length - 1].year as number
  const step = compactAxis || b - a < 40 ? (b - a > 60 ? 40 : b - a > 20 ? 10 : 5) : 20
  const out: number[] = []
  for (let y = Math.ceil(a / step) * step; y <= b; y += step) out.push(y)
  return out
}
