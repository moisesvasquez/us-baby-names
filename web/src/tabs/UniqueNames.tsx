import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { compact, fmt } from '../lib/format'
import { useMobile } from '../lib/useMobile'

// ---------- Types & filter state ----------

type SexFilter = 'all' | 'F' | 'M' | 'unisex'
type Trend = 'any' | 'rising' | 'steady' | 'falling' | 'new'
type Sort = 'rare' | 'common' | 'az' | 'za' | 'rising' | 'random'

export interface Filters {
  sex: SexFilter; years: string; min: string; max: string; minLen: string; maxLen: string
  starts: string; ends: string; contains: string; trend: Trend; vintage: boolean; sort: Sort; seed: string
}

const DEFAULTS: Filters = {
  sex: 'all', years: '5', min: '5', max: '100', minLen: '', maxLen: '',
  starts: '', ends: '', contains: '', trend: 'any', vintage: false, sort: 'random', seed: '',
}

const WINDOWS: [string, string][] = [['1', 'year'], ['3', '3 years'], ['5', '5 years'], ['10', '10 years'], ['20', '20 years'], ['50', '50 years'], ['all', 'all years (since 1880)']]

const PRESETS: { label: string; hint: string; f: Partial<Filters> }[] = [
  { label: 'Ultra rare', hint: '25 or fewer babies in 5 years', f: { min: '5', max: '25', years: '5', trend: 'any', vintage: false, sort: 'random' } },
  { label: 'Rare', hint: 'Under 100 in 5 years', f: { min: '5', max: '100', years: '5', trend: 'any', vintage: false, sort: 'random' } },
  { label: 'Uncommon but known', hint: '250–1,000 in 5 years', f: { min: '250', max: '1000', years: '5', trend: 'any', vintage: false, sort: 'random' } },
  { label: 'Rising stars', hint: 'Small but growing fast', f: { min: '100', max: '2500', years: '10', trend: 'rising', vintage: false, sort: 'rising' } },
  { label: 'Forgotten classics', hint: 'Once 1,000+ a year, now rare', f: { min: '5', max: '150', years: '5', trend: 'any', vintage: true, sort: 'random' } },
  { label: 'Brand new', hint: 'First recorded in the last 5 years', f: { min: '5', max: '100000', years: '5', trend: 'new', vintage: false, sort: 'common' } },
]

const SORT_LABELS: [Sort, string][] = [['rare', 'Rarest first'], ['common', 'Most common first'], ['rising', 'Rising fastest'], ['az', 'A → Z'], ['za', 'Z → A'], ['random', 'Shuffled']]

export function filtersFromParams(p: URLSearchParams): Filters {
  const f = { ...DEFAULTS }
  for (const k of Object.keys(DEFAULTS) as (keyof Filters)[]) {
    const v = p.get(k)
    if (v == null) continue
    if (k === 'vintage') f.vintage = v === 'true'
    else (f as unknown as Record<string, string>)[k] = v
  }
  return f
}

/** Only non-default values go in the URL so shared links stay short. */
export function filtersToParams(f: Filters): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of Object.keys(DEFAULTS) as (keyof Filters)[]) {
    const v = f[k]
    if (v === DEFAULTS[k]) continue
    if (k === 'seed' && f.sort !== 'random') continue
    out[k] = String(v)
  }
  return out
}

const onlyLetters = (s: string) => s.replace(/[^A-Za-z]/g, '').slice(0, 15)
const onlyDigits = (s: string) => s.replace(/[^0-9]/g, '').slice(0, 8)

// ---------- API ----------

interface Row {
  name: string; count: number; female: number; male: number; yearsUsed: number
  firstYear: number; peakYearCount: number; trend: 'rising' | 'steady' | 'falling' | 'new' | null; changePct: number | null
}
interface Result { matches: number; names: Row[]; filters: { from: number; to: number } }

function apiQuery(f: Filters, offset: number) {
  const q = new URLSearchParams({ sex: f.sex, years: f.years, sort: f.sort, limit: '50', offset: String(offset) })
  if (f.min) q.set('min', f.min)
  if (f.max) q.set('max', f.max)
  if (f.minLen) q.set('minLen', f.minLen)
  if (f.maxLen) q.set('maxLen', f.maxLen)
  if (f.starts) q.set('starts', f.starts)
  if (f.ends) q.set('ends', f.ends)
  if (f.contains) q.set('contains', f.contains)
  if (f.trend !== 'any') q.set('trend', f.trend)
  if (f.vintage) q.set('vintage', 'true')
  if (f.sort === 'random') q.set('seed', f.seed || 'x')
  return '/api/unique?' + q
}

// ---------- Shortlist (per-viewer, browser storage) ----------

interface Saved { name: string; sex: SexFilter }
function loadShortlist(): Saved[] {
  try { return JSON.parse(localStorage.getItem('shortlist') ?? '[]') } catch { return [] }
}
function saveShortlist(list: Saved[]) {
  try { localStorage.setItem('shortlist', JSON.stringify(list)) } catch { /* storage unavailable */ }
}

// ---------- Page ----------

interface Props {
  params: URLSearchParams
  onChange: (params: Record<string, string>) => void
  onExplore: (name: string, sex: 'F' | 'M' | 'B') => void
  onCompare: (names: string[]) => void
}

export function UniqueNames({ params, onChange, onExplore, onCompare }: Props) {
  const applied = useMemo(() => filtersFromParams(params), [params])
  // Text and number fields are edited locally and pushed to the URL after a short pause.
  const [draft, setDraft] = useState<Filters>(applied)
  const [result, setResult] = useState<Result | null>(null)
  const [extra, setExtra] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(() => applied.trend !== 'any' || applied.vintage || !!applied.contains)
  const [shortlist, setShortlist] = useState<Saved[]>(loadShortlist)
  const key = apiQuery(applied, 0)

  useEffect(() => { setDraft(applied) }, [applied])

  // Debounce draft -> URL
  useEffect(() => {
    const t = setTimeout(() => {
      const next = filtersToParams(draft)
      const cur = filtersToParams(applied)
      if (JSON.stringify(next) !== JSON.stringify(cur)) onChange(next)
    }, 350)
    return () => clearTimeout(t)
  }, [draft, applied, onChange])

  // Fetch first page whenever the applied filters change
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    setOpen(null)
    setExtra([])
    fetch(key, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body?.error?.message ?? 'Request failed')
        setResult(body)
      })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setResult(null) } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [key])

  async function loadMore() {
    if (!result) return
    setLoading(true)
    try {
      const r = await fetch(apiQuery(applied, result.names.length + extra.length))
      const body: Result = await r.json()
      setExtra((x) => [...x, ...body.names])
    } finally {
      setLoading(false)
    }
  }

  const set = (patch: Partial<Filters>) => setDraft((d) => ({ ...d, ...patch }))
  // Discrete controls apply immediately (no debounce).
  const apply = (patch: Partial<Filters>) => { const next = { ...draft, ...patch }; setDraft(next); onChange(filtersToParams(next)) }

  const rows = result ? [...result.names, ...extra] : []
  const isSaved = (n: string) => shortlist.some((s) => s.name === n)
  const toggleSave = (n: string) => {
    const next = isSaved(n) ? shortlist.filter((s) => s.name !== n) : [...shortlist, { name: n, sex: applied.sex }]
    setShortlist(next)
    saveShortlist(next)
  }
  const windowLabel = WINDOWS.find(([v]) => v === applied.years)?.[1] ?? `${applied.years} years`
  const trendDisabled = applied.years === '1'
  const activePreset = PRESETS.find((p) => Object.entries(p.f).every(([k, v]) => applied[k as keyof Filters] === v))

  return (
    <>
      <section className="section" style={{ paddingTop: 28, borderBottom: 0, paddingBottom: 8 }}>
        <h2 className="section-title">Find a unique name</h2>
        <p className="section-sub">
          Narrow down 105,966 names to the ones few parents are choosing. Tap a name to see how often it’s been used in the years you picked.
        </p>

        <div className="presets" style={{ marginTop: 4 }}>
          {PRESETS.map((p) => (
            <button key={p.label} className={'chip' + (activePreset === p ? ' chip-on' : '')} title={p.hint}
              onClick={() => apply({ ...p.f })}>{p.label}</button>
          ))}
        </div>

        <div className="finder">
          <div className="f-field f-wide">
            <span className="f-label">Gender</span>
            <div className="seg seg-full" role="group" aria-label="Gender">
              {([['all', 'Any'], ['F', 'Girls'], ['M', 'Boys'], ['unisex', 'Unisex']] as [SexFilter, string][]).map(([v, l]) => (
                <button key={v} aria-pressed={draft.sex === v} onClick={() => apply({ sex: v })}>{l}</button>
              ))}
            </div>
          </div>

          <label className="f-field">
            <span className="f-label">Starts with</span>
            <input className="f-input" value={draft.starts} placeholder="e.g. El" autoCapitalize="words" autoComplete="off"
              onChange={(e) => set({ starts: onlyLetters(e.target.value) })} />
          </label>
          <label className="f-field">
            <span className="f-label">Ends with</span>
            <input className="f-input" value={draft.ends} placeholder="e.g. a" autoComplete="off"
              onChange={(e) => set({ ends: onlyLetters(e.target.value) })} />
          </label>

          <div className="f-field">
            <span className="f-label">Number of letters</span>
            <div className="f-row">
              <select className="f-input" aria-label="Minimum letters" value={draft.minLen} onChange={(e) => apply({ minLen: e.target.value })}>
                <option value="">Any</option>
                {range(2, 15).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="f-to">to</span>
              <select className="f-input" aria-label="Maximum letters" value={draft.maxLen} onChange={(e) => apply({ maxLen: e.target.value })}>
                <option value="">Any</option>
                {range(2, 15).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="f-field f-span3">
            <span className="f-label">How rare</span>
            <div className="f-sentence">
              <span>Given to</span>
              <input className="f-input f-num" inputMode="numeric" aria-label="Minimum babies" value={draft.min}
                onChange={(e) => set({ min: onlyDigits(e.target.value) })} />
              <span>to</span>
              <input className="f-input f-num" inputMode="numeric" aria-label="Maximum babies" value={draft.max}
                onChange={(e) => set({ max: onlyDigits(e.target.value) })} />
              <span>babies in the last</span>
              <select className="f-input" aria-label="Time window" value={draft.years}
                onChange={(e) => apply({ years: e.target.value, ...(e.target.value === '1' && ['rising', 'steady', 'falling'].includes(draft.trend) ? { trend: 'any' as Trend } : {}) })}>
                {WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button className="link-btn" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}>
          {moreOpen ? 'Fewer filters' : 'More filters'}
        </button>
        {moreOpen && (
          <div className="finder" style={{ marginTop: 8 }}>
            <label className="f-field">
              <span className="f-label">Contains</span>
              <input className="f-input" value={draft.contains} placeholder="e.g. ri" autoComplete="off"
                onChange={(e) => set({ contains: onlyLetters(e.target.value) })} />
            </label>
            <label className="f-field">
              <span className="f-label">Trend in that window</span>
              <select className="f-input" value={draft.trend} onChange={(e) => apply({ trend: e.target.value as Trend })}>
                <option value="any">Any</option>
                <option value="rising" disabled={trendDisabled}>Rising</option>
                <option value="steady" disabled={trendDisabled}>Steady</option>
                <option value="falling" disabled={trendDisabled}>Falling</option>
                <option value="new">Brand new (first recorded in window)</option>
              </select>
            </label>
            <label className="f-field f-wide f-check">
              <input type="checkbox" checked={draft.vintage} onChange={(e) => apply({ vintage: e.target.checked })} />
              <span>Only forgotten classics: names that once had 1,000+ babies in a single year</span>
            </label>
          </div>
        )}
      </section>

      {shortlist.length > 0 && (
        <section className="shortlist">
          <div className="shortlist-head">
            <b>Your shortlist</b>
            <span className="note">Saved on this device</span>
          </div>
          <div className="controls" style={{ marginTop: 8, gap: 8 }}>
            {shortlist.map((s) => (
              <span key={s.name} className="chip" style={{ cursor: 'default' }}>
                <button className="chip-link" onClick={() => onExplore(s.name, s.sex === 'F' || s.sex === 'M' ? s.sex : 'B')}>{s.name}</button>
                <button className="x-btn" aria-label={`Remove ${s.name}`} onClick={() => toggleSave(s.name)}>×</button>
              </span>
            ))}
            {shortlist.length <= 4 && shortlist.length > 1 && (
              <button className="link-btn" onClick={() => onCompare(shortlist.map((s) => s.name))}>Compare these</button>
            )}
            <button className="link-btn" onClick={() => { setShortlist([]); saveShortlist([]) }}>Clear</button>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 16 }}>
        <div className="results-head">
          <div aria-live="polite">
            {error ? <span className="err">{error}</span>
              : result ? <><b className="results-n">{fmt(result.matches)}</b> {result.matches === 1 ? 'name matches' : 'names match'}</>
                : 'Searching…'}
          </div>
          <div className="results-tools">
            <select className="f-input f-sort" aria-label="Sort" value={applied.sort}
              onChange={(e) => apply({ sort: e.target.value as Sort, seed: e.target.value === 'random' ? Math.random().toString(36).slice(2, 8) : '' })}>
              {SORT_LABELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="chip" onClick={() => apply({ sort: 'random', seed: Math.random().toString(36).slice(2, 8) })}>Shuffle</button>
            <button className="link-btn" onClick={() => { setDraft(DEFAULTS); onChange({}) }}>Reset</button>
          </div>
        </div>
        <p className="note" style={{ margin: '4px 0 12px' }}>
          Counts are babies in the last {windowLabel} ({result?.filters.from ?? ''}–{result?.filters.to ?? ''}). SSA only lists a name in years it reached 5 babies of one sex, so true counts can be a little higher.
        </p>

        {result && result.matches === 0 && !loading && (
          <div className="empty">
            <p className="empty-title">No names match</p>
            Try widening the baby range, a longer time window, or fewer letters in “starts with” / “ends with”.
          </div>
        )}

        <ul className={'name-list' + (loading && !extra.length ? ' is-loading' : '')}>
          {rows.map((r) => (
            <NameRow key={r.name} r={r} sex={applied.sex} years={applied.years} from={result!.filters.from} to={result!.filters.to}
              open={open === r.name} onToggle={() => setOpen(open === r.name ? null : r.name)}
              saved={isSaved(r.name)} onSave={() => toggleSave(r.name)} onExplore={onExplore} />
          ))}
        </ul>

        {result && rows.length < result.matches && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button className="chip" onClick={loadMore} disabled={loading}>{loading ? 'Loading…' : `Show 50 more (${fmt(result.matches - rows.length)} left)`}</button>
          </div>
        )}
      </section>
    </>
  )
}

function range(a: number, b: number) { return Array.from({ length: b - a + 1 }, (_, i) => a + i) }

// ---------- One result row with expandable histogram ----------

function NameRow({ r, sex, years, from, to, open, onToggle, saved, onSave, onExplore }: {
  r: Row; sex: SexFilter; years: string; from: number; to: number; open: boolean; onToggle: () => void
  saved: boolean; onSave: () => void; onExplore: (name: string, sex: 'F' | 'M' | 'B') => void
}) {
  const girlShare = r.female + r.male ? r.female / (r.female + r.male) : 0
  const who = sex === 'F' ? 'Girls' : sex === 'M' ? 'Boys'
    : girlShare >= 0.95 ? 'Girls' : girlShare <= 0.05 ? 'Boys' : `${Math.round(girlShare * 100)}% girls`
  const exploreSex: 'F' | 'M' | 'B' = sex === 'F' || sex === 'M' ? sex : girlShare >= 0.95 ? 'F' : girlShare <= 0.05 ? 'M' : 'B'
  return (
    <li className={'name-row' + (open ? ' open' : '')}>
      <div className="name-row-main">
        <button className={'heart' + (saved ? ' on' : '')} onClick={onSave} aria-pressed={saved} aria-label={saved ? `Remove ${r.name} from shortlist` : `Save ${r.name} to shortlist`}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2.1 0 3.6 1.1 5 2.9 1.4-1.8 2.9-2.9 5-2.9 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z"
              fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="name-row-btn" onClick={onToggle} aria-expanded={open}>
          <span className="nr-name">{r.name}</span>
          <span className="nr-meta">
            <span>{who}</span>
            {r.trend && (r.trend === 'new' || r.count >= 25) && <TrendTag t={r.trend} pct={r.changePct} />}
          </span>
          <span className="nr-count"><b>{fmt(r.count)}</b><span className="note"> babies</span></span>
          <svg className="chev" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {open && <Histogram name={r.name} sex={sex} from={from} to={to} years={years} row={r} onExplore={() => onExplore(r.name, exploreSex)} />}
    </li>
  )
}

function TrendTag({ t, pct }: { t: NonNullable<Row['trend']>; pct: number | null }) {
  const cls = t === 'rising' || t === 'new' ? 'up' : t === 'falling' ? 'down' : ''
  const label = t === 'new' ? 'New' : t === 'rising' ? (pct != null && pct >= 200 ? `↑ ×${(pct / 100 + 1).toFixed(0)}` : `↑ ${Math.round(pct ?? 0)}%`)
    : t === 'falling' ? `↓ ${Math.abs(Math.round(pct ?? 0))}%` : 'Steady'
  return <span className={'badge ' + cls}>{label}</span>
}

interface YearPoint { year: number; count?: number; female?: number; male?: number }

function Histogram({ name, sex, from, to, years, row, onExplore }: {
  name: string; sex: SexFilter; from: number; to: number; years: string; row: Row; onExplore: () => void
}) {
  const mobile = useMobile()
  const [data, setData] = useState<YearPoint[] | null>(null)
  const [err, setErr] = useState('')
  const single = sex === 'F' || sex === 'M'
  const reqRef = useRef(0)

  useEffect(() => {
    const id = ++reqRef.current
    const apiSex = single ? sex : 'all'
    fetch(`/api/names/${encodeURIComponent(name)}?sex=${apiSex}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((body) => {
        if (id !== reqRef.current) return
        if (body.error) throw new Error(body.error.message)
        const by = new Map<number, YearPoint>(body.years.map((p: YearPoint) => [p.year, p]))
        // Fill missing years with zero so the window is continuous.
        setData(range(from, to).map((y) => by.get(y) ?? (single ? { year: y, count: 0 } : { year: y, count: 0, female: 0, male: 0 })))
      })
      .catch((e) => setErr(e.message))
  }, [name, sex, from, to, single])

  const color = sex === 'M' ? 'var(--accent-2)' : 'var(--accent)'
  const tickEvery = to - from > 60 ? 20 : to - from > 20 ? 10 : to - from > 8 ? 2 : 1
  const ticks = range(from, to).filter((y) => y % tickEvery === 0 || to - from <= 8)

  return (
    <div className="hist">
      {err ? <p className="err">{err}</p> : !data ? <p className="note">Loading…</p> : (
        <>
          {!single && (
            <div className="legend" style={{ marginBottom: 0 }}>
              <span><i className="swatch" style={{ background: 'var(--accent)' }} />Girls</span>
              <span><i className="swatch" style={{ background: 'var(--accent-2)' }} />Boys</span>
            </div>
          )}
          <div style={{ width: '100%', height: mobile ? 150 : 170 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }} barCategoryGap={to - from > 40 ? 1 : '20%'}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="year" ticks={ticks} interval={0} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={compact} />
                <Tooltip
                  cursor={{ fill: 'var(--chip)' }}
                  content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="tt"><div className="y">{label}</div>
                      {single
                        ? <div className="row"><span>Babies</span><span className="num">{fmt(Number(payload[0].value))}</span></div>
                        : payload.map((p) => <div className="row" key={String(p.dataKey)}><span><i className="swatch" style={{ background: p.color }} />{p.dataKey === 'female' ? 'Girls' : 'Boys'}</span><span className="num">{fmt(Number(p.value))}</span></div>)}
                    </div>
                  ) : null}
                />
                {single
                  ? <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                  : <>
                    <Bar dataKey="female" stackId="s" fill="var(--accent)" maxBarSize={24} isAnimationActive={false} />
                    <Bar dataKey="male" stackId="s" fill="var(--accent-2)" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                  </>}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      <div className="hist-facts">
        <span>First recorded <b>{row.firstYear}</b></span>
        <span>Used in <b>{row.yearsUsed}</b> of {years === 'all' ? to - from + 1 : years} years</span>
        <span>All-time best year: <b>{fmt(row.peakYearCount)}</b> babies</span>
        <button className="link-btn" onClick={onExplore}>Full history →</button>
      </div>
    </div>
  )
}
