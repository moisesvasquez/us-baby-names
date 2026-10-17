import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Brush, CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { loadMeta, loadStories, type Meta, type Story, type Surge } from '../lib/data'
import { compact, fmt } from '../lib/format'
import { yearTicks } from '../components/TrendChart'
import { brushProps, RangeLabel, useRange } from '../components/range'
import { useMobile } from '../lib/useMobile'

type Pick = (name: string, sex: 'F' | 'M' | 'B') => void

export function Stories({ onPick }: { onPick: Pick }) {
  const [data, setData] = useState<{ stories: Story[]; surges: Surge[] } | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [cat, setCat] = useState('All')
  useEffect(() => { loadStories().then(setData); loadMeta().then(setMeta) }, [])

  const cats = useMemo(() => ['All', ...new Set(data?.stories.map((s) => s.category) ?? [])], [data])
  if (!data || !meta) return <div className="empty">Loading…</div>
  const shown = data.stories.filter((s) => cat === 'All' || s.category === cat)

  return (
    <>
      <section className="section" style={{ paddingTop: 28 }}>
        <h2 className="section-title">Names that made headlines</h2>
        <p className="section-sub">Movies, songs, athletes, presidents and disasters leave fingerprints in the birth records. The dashed line marks the event.</p>
        <div className="controls" style={{ marginTop: 0, gap: 8 }}>
          {cats.map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c}
              style={cat === c ? { background: 'var(--ink)', color: 'var(--page)' } : undefined}
              onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="story-grid" style={{ marginTop: 28 }}>
          {shown.map((s) => <StoryCard key={s.name + s.year} s={s} onPick={onPick} />)}
        </div>
      </section>

      <section className="section">
        <div className="grid-2">
          <div>
            <h3 className="section-title">The biggest one-year surges</h3>
            <p className="section-sub">Found automatically: a year at least 6× the average of the three years before (400+ babies). Most have a pop-culture trigger. Some are still mysteries.</p>
            <ul className="ranklist">
              {data.surges.slice(0, 12).map((s) => (
                <li key={s.name + s.sex}>
                  <span className="big">{s.factor}×</span>
                  <span>
                    <button style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }} onClick={() => onPick(s.name, s.sex)}>{s.name}</button>
                    <div className="s">{s.sex === 'F' ? 'Girls' : 'Boys'}, {s.year}: about {fmt(s.before)} a year → {fmt(s.count)}{s.tenYearsLater != null ? ` · ${fmt(s.tenYearsLater)} ten years later` : ''}</div>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <BirthsChart meta={meta} />
        </div>
      </section>
    </>
  )
}

function StoryCard({ s, onPick }: { s: Story; onPick: Pick }) {
  const color = s.sex === 'F' ? 'var(--accent)' : 'var(--accent-2)'
  const data = s.series.map(([year, count]) => ({ year, count }))
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a))
  return (
    <article className="story">
      <div className="cat">{s.category} · {s.year}</div>
      <h3>{s.title}</h3>
      <div className="nm">{s.name} ({s.sex === 'F' ? 'girls' : 'boys'}), {s.from}–{s.to}</div>
      <div className="chart">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--muted)', fontSize: 11 }} ticks={yearTicks(data, true)} />
            <YAxis tickLine={false} axisLine={false} width={36} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={compact} />
            <ReferenceLine x={s.year} stroke="var(--ink-2)" strokeDasharray="3 3" />
            <Tooltip cursor={{ stroke: 'var(--axis)' }} content={({ active, payload, label }) => active && payload?.length ? (
              <div className="tt"><div className="y">{label}</div><div className="row"><span>{s.name}</span><span className="num">{fmt(Number(payload[0].value))}</span></div></div>
            ) : null} />
            <Area dataKey="count" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} isAnimationActive={false} />
            <ReferenceDot x={peak.year} y={peak.count} r={4} fill={color} stroke="var(--page)" strokeWidth={2}
              label={{ value: fmt(peak.count), position: 'top', fontSize: 11, fill: 'var(--ink)', fontWeight: 600 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p>{s.text}</p>
      <button className="link" onClick={() => onPick(s.name, s.sex)}>Explore {s.name} →</button>
    </article>
  )
}

const EVENTS = [
  { year: 1933, label: 'Depression', pos: 'bottom' },
  { year: 1957, label: 'Baby boom', pos: 'top' },
  { year: 1973, label: 'Baby bust', pos: 'bottom' },
  { year: 2007, label: '2007 peak', pos: 'top' },
  { year: 2020, label: 'Pandemic', pos: 'bottom' },
] as const

function BirthsChart({ meta }: { meta: Meta }) {
  const data = meta.births.F.map((f, i) => ({ year: meta.firstYear + i, total: f + meta.births.M[i] }))
  const mobile = useMobile()
  const r = useRange(data.length)
  return (
    <div>
      <h3 className="section-title">History in the totals</h3>
      <p className="section-sub">Babies recorded per year. Before 1937 Social Security numbers weren’t needed, so early years are undercounted.</p>
      <RangeLabel r={r} from={data[r.start].year} to={data[r.end].year} />
      <div className="zoom-chart" style={{ width: '100%', height: (mobile ? 240 : 280) + 44 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 24, right: mobile ? 14 : 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--muted)', fontSize: 12 }} ticks={yearTicks(data.slice(r.start, r.end + 1), true)} />
            <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={compact} />
            <Tooltip cursor={{ stroke: 'var(--axis)' }} content={({ active, payload, label }) => active && payload?.length ? (
              <div className="tt"><div className="y">{label}</div><div className="row"><span>Babies</span><span className="num">{fmt(Number(payload[0].value))}</span></div></div>
            ) : null} />
            <Line dataKey="total" stroke="var(--accent-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
            {EVENTS.map((e) => {
              const v = data[e.year - meta.firstYear]?.total
              return v ? <ReferenceDot key={e.year} x={e.year} y={v} r={4} fill="var(--accent-2)" stroke="var(--page)" strokeWidth={2}
                ifOverflow="discard" label={{ value: e.label, position: e.pos, fontSize: 11, fill: 'var(--ink-2)', offset: 8 }} /> : null
            })}
            <Brush {...brushProps(r, 'year')} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
