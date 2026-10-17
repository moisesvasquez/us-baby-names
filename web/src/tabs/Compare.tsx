import { useEffect, useMemo, useRef, useState } from 'react'
import { loadMeta, loadName, type Meta, type NameRecord, type Sex } from '../lib/data'
import { series, summarize, TREND_SPAN, type Summary } from '../lib/stats'
import { fmt, sexLabel } from '../lib/format'
import { NameSearch } from '../components/NameSearch'
import { SexFilter } from '../components/SexFilter'
import { TrendBadge } from '../components/Stat'
import { TrendChart, type Metric } from '../components/TrendChart'
import { MetricToggle } from '../components/MetricToggle'

export const MAX_COMPARE = 4
const SLOT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)']

const PRESETS: { label: string; names: string[]; sex: Sex }[] = [
  { label: 'Girls through the eras', names: ['Mary', 'Linda', 'Jennifer', 'Olivia'], sex: 'F' },
  { label: 'The -ayden wave', names: ['Aiden', 'Jayden', 'Brayden', 'Kayden'], sex: 'M' },
  { label: 'Biblical boys', names: ['John', 'James', 'Noah', 'Elijah'], sex: 'M' },
  { label: 'Royal family', names: ['William', 'Harry', 'Charlotte', 'George'], sex: 'B' },
  { label: 'Disney princesses', names: ['Ariel', 'Jasmine', 'Elsa', 'Moana'], sex: 'F' },
  { label: 'Old names coming back', names: ['Theodore', 'Hazel', 'Henry', 'Violet'], sex: 'B' },
]

interface Props { names: string[]; sex: Sex; onChange: (names: string[], sex: Sex) => void }

export function Compare({ names, sex, onChange }: Props) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [records, setRecords] = useState<Record<string, NameRecord | null>>({})
  const [metric, setMetric] = useState<Metric>('perMillion')

  // Color follows the name: a name keeps its slot until removed, survivors never repaint.
  const slots = useRef<Record<string, number>>({})
  const slotOf = (n: string) => {
    if (slots.current[n] == null) {
      const used = new Set(names.filter((x) => x !== n).map((x) => slots.current[x]))
      slots.current[n] = [0, 1, 2, 3].find((i) => !used.has(i)) ?? 0
    }
    return slots.current[n]
  }
  for (const k of Object.keys(slots.current)) if (!names.includes(k)) delete slots.current[k]
  names.forEach(slotOf)

  useEffect(() => { loadMeta().then(setMeta) }, [])
  useEffect(() => {
    let live = true
    Promise.all(names.map(async (n) => [n, await loadName(n)] as const)).then((rows) => {
      if (live) setRecords(Object.fromEntries(rows))
    })
    return () => { live = false }
  }, [names])

  const rows = useMemo(() => {
    if (!meta) return []
    return names.map((n) => {
      const rec = records[n]
      return {
        name: n,
        color: SLOT_COLORS[slotOf(n)],
        summary: rec ? summarize(rec, sex, meta) : null,
        points: rec ? series(rec, sex, meta) : [],
      }
    })
  }, [names, records, sex, meta])

  const data = useMemo(() => {
    if (!meta) return []
    const out: Record<string, number | null>[] = []
    for (let y = meta.firstYear; y <= meta.lastYear; y++) {
      const row: Record<string, number | null> = { year: y }
      for (const r of rows) {
        const p = r.points[y - meta.firstYear]
        row[r.name] = p && p.count ? (metric === 'count' ? p.count : metric === 'rank' ? p.rank : p.perMillion) : null
      }
      out.push(row)
    }
    return out
  }, [rows, metric, meta])

  const markers = rows.filter((r) => r.summary).map((r) => {
    const s = r.summary!
    const year = metric === 'rank' ? s.best.year : s.peak.year
    return { key: r.name, year, value: data[year - meta!.firstYear]?.[r.name] as number, label: String(year), color: r.color }
  })

  const ranked = [...rows].filter((r) => r.summary).sort((a, b) => b.summary!.total - a.summary!.total)

  const add = (n: string) => {
    if (names.includes(n) || names.length >= MAX_COMPARE) return
    onChange([...names, n], sex)
  }
  const remove = (n: string) => onChange(names.filter((x) => x !== n), sex)

  return (
    <>
      <div className="controls">
        {names.length < MAX_COMPARE
          ? <NameSearch sex={sex} clearOnPick placeholder={`Add a name (${names.length}/${MAX_COMPARE})…`} onPick={add} />
          : <div className="note" style={{ flex: '1 1 320px' }}>Four names max: remove one to add another.</div>}
        <SexFilter value={sex} onChange={(s) => onChange(names, s)} />
      </div>
      {names.length > 0 && (
        <div className="controls" style={{ marginTop: 16, gap: 8 }}>
          {rows.map((r) => (
            <button key={r.name} className="chip" onClick={() => remove(r.name)} aria-label={`Remove ${r.name}`}>
              <i className="swatch" style={{ background: r.color }} />{r.name}<span className="x">×</span>
            </button>
          ))}
          <button className="link-btn" onClick={() => { slots.current = {}; onChange([], 'B') }}>Clear all</button>
        </div>
      )}
      <div className="presets">
        <span className="note">Try:</span>
        {PRESETS.map((p) => (
          <button key={p.label} className="chip" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => { slots.current = {}; onChange(p.names, p.sex) }}>{p.label}</button>
        ))}
      </div>

      {!meta || names.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Compare up to four names</p>
          Search names above, or tap one of the suggested sets, to see their trends, peak years, average ages and where each is heading.
        </div>
      ) : (
        <>
          <div className="stats" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))` }}>
            {rows.map((r) => <NameCard key={r.name} name={r.name} color={r.color} s={r.summary} sex={sex} />)}
          </div>

          <section className="section">
            <div className="chart-head">
              <div>
                <h3 className="section-title">Trends</h3>
                <p className="section-sub" style={{ margin: 0 }}>
                  {metric === 'perMillion' ? 'Per million births, so eras with more babies don’t dominate.' : metric === 'count' ? `Number of ${sexLabel[sex]} per year.` : 'Yearly rank (log scale, #1 at top).'} Dots mark each name’s {metric === 'rank' ? 'best rank' : 'peak year'}.
                </p>
              </div>
              <MetricToggle value={metric} onChange={setMetric} />
            </div>
            <div className="legend">
              {rows.map((r) => <span key={r.name}><i className="line-key" style={{ background: r.color }} />{r.name}</span>)}
            </div>
            <TrendChart data={data} series={rows.map((r) => ({ key: r.name, label: r.name, color: r.color }))} metric={metric} markers={markers} />
          </section>

          <section className="section">
            <h3 className="section-title">Side by side</h3>
            <p className="section-sub">Ranked by total {sexLabel[sex]} since 1880.</p>
            <ol className="compare-cards">
              {ranked.map((r, i) => {
                const s = r.summary!
                return (
                  <li key={r.name}>
                    <div className="cc-head"><span className="cc-rank">{i + 1}</span><i className="swatch" style={{ background: r.color }} /><b>{r.name}</b><TrendBadge trend={s.trend} /></div>
                    <dl>
                      <div><dt>Total</dt><dd>{fmt(s.total)}</dd></div>
                      <div><dt>Peak year</dt><dd><b>{s.peak.year}</b> · {fmt(s.peak.count)}</dd></div>
                      <div><dt>Best rank</dt><dd>#{s.best.rank} ({s.best.year})</dd></div>
                      <div><dt>{meta.lastYear}</dt><dd>{s.latest.count ? `${fmt(s.latest.count)} · #${fmt(s.latest.rank ?? 0)}` : '—'}</dd></div>
                      <div><dt>Avg age</dt><dd>{s.age ? Math.round(s.age.mean) : '—'}</dd></div>
                    </dl>
                  </li>
                )
              })}
            </ol>
            <div className="table-wrap compare-table">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th className="num">Total</th><th className="num">Peak year</th><th className="num">Babies at peak</th>
                    <th className="num">Best rank</th><th className="num">{meta.lastYear} babies</th><th className="num">{meta.lastYear} rank</th>
                    <th className="num">Avg age</th><th>{TREND_SPAN}-yr trend</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r, i) => {
                    const s = r.summary!
                    return (
                      <tr key={r.name}>
                        <td>{i + 1}</td>
                        <td className="name"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><i className="swatch" style={{ background: r.color }} />{r.name}</span></td>
                        <td className="num">{fmt(s.total)}</td>
                        <td className="num"><b>{s.peak.year}</b></td>
                        <td className="num">{fmt(s.peak.count)}</td>
                        <td className="num">#{s.best.rank} <span className="note">({s.best.year})</span></td>
                        <td className="num">{s.latest.count ? fmt(s.latest.count) : '—'}</td>
                        <td className="num">{s.latest.rank ? '#' + fmt(s.latest.rank) : '—'}</td>
                        <td className="num">{s.age ? Math.round(s.age.mean) : '—'}</td>
                        <td><TrendBadge trend={s.trend} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {rows.some((r) => !r.summary) && (
              <p className="note" style={{ marginTop: 12 }}>
                No {sexLabel[sex]} records for: {rows.filter((r) => !r.summary).map((r) => r.name).join(', ')}.
              </p>
            )}
          </section>
        </>
      )}
    </>
  )
}

function NameCard({ name, color, s, sex }: { name: string; color: string; s: Summary | null; sex: Sex }) {
  return (
    <div className="stat">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <i className="line-key" style={{ background: color, width: 22, height: 4 }} />
        <span className="v" style={{ fontSize: 34 }}>{name}</span>
      </div>
      {s ? (
        <div className="l">
          Peaked in <b>{s.peak.year}</b> · best rank <b>#{s.best.rank}</b><br />
          Average age ≈ <b>{s.age ? Math.round(s.age.mean) : '—'}</b> · <TrendBadge trend={s.trend} />
        </div>
      ) : <div className="l">No {sexLabel[sex]} records</div>}
    </div>
  )
}
