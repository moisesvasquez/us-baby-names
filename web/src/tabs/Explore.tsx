import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { loadMeta, loadName, type Meta, type NameRecord, type Sex } from '../lib/data'
import { livingByAge, series, summarize, TREND_SPAN } from '../lib/stats'
import { compact, fmt, pct, sexLabel } from '../lib/format'
import { NameSearch } from '../components/NameSearch'
import { SexFilter } from '../components/SexFilter'
import { Stat, TrendBadge } from '../components/Stat'
import { TrendChart, type Metric } from '../components/TrendChart'
import { MetricToggle } from '../components/MetricToggle'
import { brushProps, RangeLabel, useRange } from '../components/range'
import { useMobile } from '../lib/useMobile'

interface Props { name: string; sex: Sex; onChange: (name: string, sex: Sex) => void }

export function Explore({ name, sex, onChange }: Props) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [record, setRecord] = useState<NameRecord | null | undefined>(undefined)
  const [metric, setMetric] = useState<Metric>('count')

  useEffect(() => { loadMeta().then(setMeta) }, [])
  useEffect(() => {
    let live = true
    setRecord(undefined)
    if (!name) return
    loadName(name).then((r) => { if (live) setRecord(r) })
    return () => { live = false }
  }, [name])

  const summary = useMemo(() => (meta && record ? summarize(record, sex, meta) : null), [meta, record, sex])
  const points = useMemo(() => (meta && record ? series(record, sex, meta) : []), [meta, record, sex])
  const ages = useMemo(() => (meta && record ? livingByAge(record, sex, meta) : []), [meta, record, sex])

  const color = sex === 'M' ? 'var(--accent-2)' : 'var(--accent)'
  const data = points.map((p) => ({ year: p.year, v: p.count ? (metric === 'rank' ? p.rank : metric === 'count' ? p.count : p.perMillion) : null }))

  // Girls' share, shown when both are selected
  const girlShare = record?.F || record?.M
    ? (() => {
      const f = record?.F?.[1].reduce((a, b) => a + b, 0) ?? 0
      const m = record?.M?.[1].reduce((a, b) => a + b, 0) ?? 0
      return f / (f + m)
    })() : null

  const markers = summary ? (metric === 'rank'
    ? [{ key: 'best', year: summary.best.year, value: summary.best.rank, label: `#${summary.best.rank} in ${summary.best.year}`, color }]
    : [{ key: 'peak', year: summary.peak.year, value: data[summary.peak.year - points[0].year].v as number, label: `Peak ${summary.peak.year}`, color }]
  ) : []

  return (
    <>
      <div className="controls">
        <NameSearch sex={sex} initial={name} onPick={(n) => onChange(n, sex)} />
        <SexFilter value={sex} onChange={(s) => onChange(name, s)} />
      </div>

      {!name ? (
        <div className="empty">
          <p className="empty-title">Search any name to see its story</p>
          Type a first name above to see how many babies got it each year, its peak year and best rank, and the estimated age of people who have it today.
        </div>
      ) : record === undefined || !meta ? <div className="empty">Loading {name}…</div> : !summary ? (
        <div className="empty">
          No {sexLabel[sex]} named <b>{name}</b> in the records.
          {sex !== 'B' && record && <> Try <button className="chip" onClick={() => onChange(name, 'B')}>both sexes</button></>}
        </div>
      ) : (
        <>
          <div className="name-hero">
            <h2>{name}</h2>
            <span>
              {fmt(summary.total)} {sexLabel[sex]} since {summary.firstYear}
              {sex === 'B' && girlShare != null && ` · ${Math.round(girlShare * 100)}% girls`}
            </span>
          </div>

          <div className="stats">
            <Stat value={summary.peak.year} label={<>Peak year: {fmt(summary.peak.count)} {sexLabel[sex]} named {name}</>} />
            <Stat
              value={<>#{summary.best.rank} <small>in {summary.best.year}</small></>}
              label={<>Highest rank among all {sex === 'B' ? '' : sexLabel[sex] + "’ "}names that year{summary.best.yearsAtBest > 1 ? ` (held for ${summary.best.yearsAtBest} years)` : ''}</>}
            />
            <Stat
              value={summary.latest.count ? <>{compact(summary.latest.count)} <small>#{fmt(summary.latest.rank ?? 0)}</small></> : '—'}
              label={summary.latest.count ? `Babies and rank in ${summary.latest.year}` : `Fewer than 5 babies in ${summary.latest.year}`}
            />
            <Stat
              value={summary.age ? <>{Math.round(summary.age.mean)} <small>yrs</small></> : '—'}
              label={summary.age ? `Estimated average age of a living ${name} (median ${summary.age.median})` : 'Average age'}
            />
            <Stat
              value={<span className={summary.trend.label === 'Rising' ? 'trend-up' : summary.trend.label === 'Falling' ? 'trend-down' : ''}>{summary.trend.pct == null ? summary.trend.label : pct(summary.trend.pct)}</span>}
              label={<>{TREND_SPAN}-year trend, {summary.trend.from}→{summary.trend.to}, share of births <TrendBadge trend={summary.trend} /></>}
            />
          </div>

          <section className="section">
            <div className="chart-head">
              <div>
                <h3 className="section-title">{name} over time</h3>
                <p className="section-sub" style={{ margin: 0 }}>
                  {metric === 'count' ? `Number of ${sexLabel[sex]} named ${name} each year` : metric === 'perMillion' ? 'Per million births of the same sex, which corrects for the size of each year’s cohort' : `Rank among all ${sex === 'B' ? '' : sexLabel[sex] + "’ "}names each year (log scale, #1 at top)`}
                </p>
              </div>
              <MetricToggle value={metric} onChange={setMetric} />
            </div>
            <TrendChart data={data} series={[{ key: 'v', label: name, color }]} metric={metric} markers={markers} />
            <details className="table-toggle">
              <summary>Show data table</summary>
              <YearTable points={points} />
            </details>
          </section>

          <section className="section">
            <h3 className="section-title">How old is a {name} today?</h3>
            <p className="section-sub">
              Estimated living people named {name} by age, in {meta.lastYear + 1}. Births are adjusted for mortality with a US life-table approximation; migration isn’t counted.
            </p>
            <AgeChart ages={ages} color={color} />
            {summary.age && <p className="note">About {compact(summary.age.living)} people named {name} are estimated to be alive. Half are older than {summary.age.median}.</p>}
          </section>
        </>
      )}
    </>
  )
}

function AgeChart({ ages, color }: { ages: { age: number; people: number }[]; color: string }) {
  const mobile = useMobile()
  const data = ages.filter((a) => a.age >= 0 && a.age <= 105)
  const r = useRange(data.length)
  if (!data.length) return null
  const lo = data[r.start].age, hi = data[r.end].age
  const step = hi - lo > 50 ? (mobile ? 20 : 10) : hi - lo > 20 ? 5 : 2
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
  return (
    <>
      <RangeLabel r={r} from={lo} to={hi} unit="Ages " />
      <div className="zoom-chart" style={{ width: '100%', height: (mobile ? 220 : 260) + 44 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: mobile ? 14 : 28, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="age" type="number" domain={['dataMin', 'dataMax']} ticks={ticks} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={mobile ? 40 : 52} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={compact} />
            <Tooltip
              cursor={{ stroke: 'var(--axis)' }}
              content={({ active, payload }) => active && payload?.length ? (
                <div className="tt"><div className="y">Age {payload[0].payload.age}</div>
                  <div className="row"><span>Est. living</span><span className="num">{fmt(Number(payload[0].value))}</span></div></div>
              ) : null}
            />
            <Area dataKey="people" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} isAnimationActive={false} />
            <Brush {...brushProps(r, 'age', (v) => `${v}`)} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

function YearTable({ points }: { points: { year: number; count: number; rank: number | null; perMillion: number }[] }) {
  const rows = points.filter((p) => p.count).reverse()
  return (
    <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto', marginTop: 8 }}>
      <table className="data">
        <thead><tr><th>Year</th><th className="num">Babies</th><th className="num">Rank</th><th className="num">Per million</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.year}><td>{p.year}</td><td className="num">{fmt(p.count)}</td><td className="num">#{fmt(p.rank ?? 0)}</td><td className="num">{p.perMillion.toFixed(1)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
