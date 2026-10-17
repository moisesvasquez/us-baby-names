import { useEffect, useState, type ReactNode } from 'react'
import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { loadRecent, type Mover, type Recent as RecentData } from '../lib/data'
import { compact, fmt, pct } from '../lib/format'
import { BumpChart } from '../components/BumpChart'
import { yearTicks } from '../components/TrendChart'
import { brushProps, RangeLabel, useRange } from '../components/range'
import { useMobile } from '../lib/useMobile'

export function Recent({ onPick }: { onPick: (name: string, sex: 'F' | 'M' | 'B') => void }) {
  const [d, setD] = useState<RecentData | null>(null)
  useEffect(() => { loadRecent().then(setD) }, [])
  if (!d) return <div className="empty">Loading…</div>

  const y0 = d.years[0], y1 = d.years[d.years.length - 1]
  const b1 = d.births[d.births.length - 1], bBase = d.births.find((b) => b.year === d.baseYear)!
  const u1 = d.unique[d.unique.length - 1]
  const cF = d.concentrationF, cM = d.concentrationM
  const top100Now = (cF[cF.length - 1].top100 + cM[cM.length - 1].top100) / 2
  const top100Then = (cF[0].top100 + cM[0].top100) / 2
  const holdF = streak(d.topF, d.years), holdM = streak(d.topM, d.years)

  const conc = cF.map((r, i) => ({ year: r.year, F: r.top100, M: cM[i].top100 }))

  return (
    <>
      <section className="section" style={{ paddingTop: 28 }}>
        <h2 className="section-title">The last five years, {y0}–{y1}</h2>
        <p className="section-sub">What parents have been picking lately, and how naming is changing.</p>
        <div className="facts" style={{ marginTop: 24 }}>
          <div className="fact">
            <div className="v">{compact(b1.F + b1.M)}</div>
            <div className="l">babies recorded in {y1}, {pct(((b1.F + b1.M) / (bBase.F + bBase.M) - 1) * 100, 1)} vs {d.baseYear}</div>
          </div>
          <div className="fact">
            <div className="v">{Math.round(top100Then)}% → {Math.round(top100Now)}%</div>
            <div className="l">babies given a top-100 name, {cF[0].year} vs {y1}. Parents pick rarer names every year.</div>
          </div>
          <div className="fact">
            <div className="v">{fmt(u1.F + u1.M)}</div>
            <div className="l">distinct names given in {y1} ({fmt(u1.F)} for girls, {fmt(u1.M)} for boys)</div>
          </div>
          <div className="fact">
            <div className="v">{d.top10_F[0]} & {d.top10_M[0]}</div>
            <div className="l">#1 for girls and boys in {y1}{holdF && holdM ? `, both on top all ${d.years.length} years` : ''}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid-2">
          <div>
            <h3 className="section-title">Top girls’ names</h3>
            <p className="section-sub">Rank each year, {y0}–{y1}. Tap a line to see its ranks.</p>
            <BumpChart rows={d.topF} years={d.years} accent="var(--accent)" onPick={(n) => onPick(n, 'F')} />
          </div>
          <div>
            <h3 className="section-title">Top boys’ names</h3>
            <p className="section-sub">Rank each year, {y0}–{y1}. Tap a line to see its ranks.</p>
            <BumpChart rows={d.topM} years={d.years} accent="var(--accent-2)" onPick={(n) => onPick(n, 'M')} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid-2">
          <MoverBars title="Rising fastest: girls" sub={`Growth in babies, ${d.baseYear}→${y1}. Names with 250+ babies in ${y1}.`} rows={d.risingF} color="var(--accent)" onPick={(n) => onPick(n, 'F')} />
          <MoverBars title="Rising fastest: boys" sub={`Growth in babies, ${d.baseYear}→${y1}. Names with 250+ babies in ${y1}.`} rows={d.risingM} color="var(--accent-2)" onPick={(n) => onPick(n, 'M')} />
        </div>
      </section>

      <section className="section">
        <div className="grid-2">
          <MoverBars title="Falling fastest: girls" sub={`Drop in babies, ${d.baseYear}→${y1}, among ${d.baseYear}’s top 500.`} rows={d.fallingF} color="var(--accent)" onPick={(n) => onPick(n, 'F')} falling />
          <MoverBars title="Falling fastest: boys" sub={`Drop in babies, ${d.baseYear}→${y1}, among ${d.baseYear}’s top 500.`} rows={d.fallingM} color="var(--accent-2)" onPick={(n) => onPick(n, 'M')} falling />
        </div>
      </section>

      <section className="section">
        <div className="grid-2">
          <div>
            <h3 className="section-title">Out of nowhere</h3>
            <p className="section-sub">Names with fewer than 50 babies in {d.baseYear} that are now in the top 1,000.</p>
            <ul className="ranklist">
              {[...d.newF.slice(0, 4).map((m) => ({ ...m, sex: 'F' as const })), ...d.newM.slice(0, 4).map((m) => ({ ...m, sex: 'M' as const }))]
                .sort((a, b) => b.n1 - a.n1).map((m) => (
                  <li key={m.name + m.sex}>
                    <span className="big">{compact(m.n1)}</span>
                    <span>
                      <button className="link t" style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }} onClick={() => onPick(m.name, m.sex)}>{m.name}</button>
                      <div className="s">{m.sex === 'F' ? 'Girls' : 'Boys'} · {m.n0} in {d.baseYear} → {fmt(m.n1)} in {y1} (#{m.r1})</div>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h3 className="section-title">Names for anyone</h3>
            <p className="section-sub">Popular names in {y1} split between 30% and 70% girls.</p>
            <div className="legend"><span><i className="swatch" style={{ background: 'var(--accent)' }} />Girls</span><span><i className="swatch" style={{ background: 'var(--accent-2)' }} />Boys</span></div>
            <div className="bars" style={{ gridTemplateColumns: 'minmax(80px,auto) 1fr auto' }}>
              {d.neutral.slice(0, 10).map((r) => {
                const f = r.F / (r.F + r.M)
                return [
                  <button key={r.name + 'n'} className="link" onClick={() => onPick(r.name, 'B')}>{r.name}</button>,
                  <div key={r.name + 'b'} className="split" title={`${fmt(r.F)} girls · ${fmt(r.M)} boys`}>
                    <div style={{ width: `${f * 100}%`, background: 'var(--accent)' }} />
                    <div style={{ width: `${(1 - f) * 100}%`, background: 'var(--accent-2)' }} />
                  </div>,
                  <span key={r.name + 'v'} className="val">{Math.round(f * 100)}% girls</span>,
                ]
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">The long tail is winning</h3>
        <p className="section-sub">Share of babies given one of that year’s 100 most popular names, last 30 years.</p>
        <div className="legend"><span><i className="line-key" style={{ background: 'var(--accent)' }} />Girls</span><span><i className="line-key" style={{ background: 'var(--accent-2)' }} />Boys</span></div>
        <ConcentrationChart data={conc} />
      </section>

      <section className="section">
        <h3 className="section-title">What stands out</h3>
        <Insights d={d} onPick={onPick} />
      </section>
    </>
  )
}

function streak(rows: RecentData['topF'], years: number[]) {
  const leader = rows.find((r) => r.ranks[years.length - 1] === 1)
  return leader ? leader.ranks.every((r) => r === 1) : false
}

function MoverBars({ title, sub, rows, color, onPick, falling }: { title: string; sub: string; rows: Mover[]; color: string; onPick: (n: string) => void; falling?: boolean }) {
  const list = rows.slice(0, 8)
  const max = Math.max(...list.map((r) => Math.abs(r.pct ?? 0)))
  return (
    <div>
      <h3 className="section-title">{title}</h3>
      <p className="section-sub">{sub}</p>
      <div className="bars">
        {list.map((r) => [
          <button key={r.name + 'n'} className="link" onClick={() => onPick(r.name)}>{r.name}</button>,
          <div key={r.name + 'b'} className="track" title={`${fmt(r.n0)} → ${fmt(r.n1)}`}>
            <div className="bar" style={{ width: `${(Math.abs(r.pct ?? 0) / max) * 100}%`, background: color, opacity: falling ? 0.55 : 1 }} />
          </div>,
          <span key={r.name + 'v'} className="val">{pct(r.pct)} <span className="note">{compact(r.n0)}→{compact(r.n1)}</span></span>,
        ])}
      </div>
    </div>
  )
}

function Insights({ d, onPick }: { d: RecentData; onPick: (n: string, s: 'F' | 'M' | 'B') => void }) {
  const y1 = d.years[d.years.length - 1]
  const find = (list: Mover[], n: string) => list.find((m) => m.name === n)
  const allM = [...d.risingM, ...d.newM]
  const yellowstone = ['Kayce', 'Colter', 'Dutton'].map((n) => find(allM, n)).filter(Boolean) as Mover[]
  const alexa = find(d.fallingF, 'Alexa')
  const kobe = find(d.fallingM, 'Kobe')
  const theo = d.topM.find((r) => r.name === 'Theodore')
  const Link = ({ n, s }: { n: string; s: 'F' | 'M' | 'B' }) => <button className="chip" style={{ padding: '1px 9px', fontSize: 13 }} onClick={() => onPick(n, s)}>{n}</button>

  const items: ReactNode[] = []
  if (yellowstone.length) items.push(<>The <b>Yellowstone</b> effect: the Dutton ranch saga made cowboy names boom. {yellowstone.map((m) => <span key={m.name}><Link n={m.name} s="M" /> {fmt(m.n0)}→{fmt(m.n1)} </span>)} boys, {d.baseYear}→{y1}.</>)
  if (theo) items.push(<><Link n="Theodore" s="M" /> climbed from #{theo.ranks[0]} to #{theo.ranks[theo.ranks.length - 1]}: the old-fashioned name revival is real.</>)
  if (alexa) items.push(<><Link n="Alexa" s="F" /> keeps falling ({pct(alexa.pct)} since {d.baseYear}). Sharing a name with a voice assistant is a hard sell.</>)
  if (kobe) items.push(<><Link n="Kobe" s="M" /> is down {pct(kobe.pct)} from its 2020 tribute spike, a sign of how short memorial booms tend to be.</>)
  items.push(<>Gender-neutral names are mainstream: {d.neutral.slice(0, 3).map((n) => <span key={n.name}><Link n={n.name} s="B" /> </span>)} each went to more than {compact(Math.min(...d.neutral.slice(0, 3).map((n) => n.F + n.M)))} babies in {y1}, split roughly evenly.</>)

  return (
    <ul className="ranklist" style={{ marginTop: 12 }}>
      {items.map((it, i) => (
        <li key={i} style={{ gridTemplateColumns: '40px 1fr' }}><span className="big" style={{ fontSize: 24 }}>{i + 1}</span><span style={{ color: 'var(--ink-2)' }}>{it}</span></li>
      ))}
    </ul>
  )
}

function ConcentrationChart({ data }: { data: { year: number; F: number; M: number }[] }) {
  const mobile = useMobile()
  const r = useRange(data.length)
  return (
    <>
      <RangeLabel r={r} from={data[r.start].year} to={data[r.end].year} />
      <div className="zoom-chart" style={{ width: '100%', height: (mobile ? 220 : 240) + 44 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 12, right: mobile ? 14 : 28, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--muted)', fontSize: 12 }} ticks={yearTicks(data.slice(r.start, r.end + 1), true)} />
              <YAxis domain={[0, 60]} tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={(v) => v + '%'} />
              <Tooltip cursor={{ stroke: 'var(--axis)' }} content={({ active, payload, label }) => active && payload?.length ? (
                <div className="tt"><div className="y">{label}</div>
                  {payload.map((p) => <div className="row" key={String(p.dataKey)}><span><i className="line-key" style={{ background: p.color }} />{p.dataKey === 'F' ? 'Girls' : 'Boys'}</span><span className="num">{Number(p.value).toFixed(1)}%</span></div>)}
                </div>) : null} />
              <Line dataKey="F" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="M" stroke="var(--accent-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Brush {...brushProps(r, 'year')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
    </>
  )
}
