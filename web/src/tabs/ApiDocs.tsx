import { useState } from 'react'

export const REPO_URL = 'https://github.com/moisesvasquez/us-baby-names'
const DOCS_URL = `${REPO_URL}/blob/main/docs/API.md`

interface Param { name: string; desc: string }
interface Endpoint { path: string; title: string; desc: string; params: Param[]; example: string }

const ENDPOINTS: Endpoint[] = [
  {
    path: '/api/names/{name}', title: 'One name', example: '/api/names/Mary?sex=F&from=2015',
    desc: 'Yearly counts and ranks for a name, its peak year, best rank, five-year trend and estimated average age of living people with it.',
    params: [
      { name: 'sex', desc: 'F, M or all (default all: combined counts with the female/male split)' },
      { name: 'from, to', desc: 'Year range for the series, 1880–2025. Summaries always cover all years.' },
    ],
  },
  {
    path: '/api/top', title: 'Top names in a year', example: '/api/top?year=2025&sex=F&limit=10',
    desc: 'The most popular names for one sex in one year, with count, rank and share of births.',
    params: [
      { name: 'sex', desc: 'Required. F or M' },
      { name: 'year', desc: '1880–2025 (default 2025)' },
      { name: 'limit, offset', desc: 'Page size up to 100 (default 10) and starting offset' },
    ],
  },
  {
    path: '/api/search', title: 'Search', example: '/api/search?q=ari&limit=5',
    desc: 'Names starting with a prefix, most popular first. Handy for autocomplete.',
    params: [
      { name: 'q', desc: 'Required. 1–15 letters' },
      { name: 'sex', desc: 'F, M or all (default all)' },
      { name: 'limit', desc: 'Up to 50 (default 10)' },
    ],
  },
  {
    path: '/api/compare', title: 'Compare names', example: '/api/compare?names=Linda,Jennifer,Olivia&sex=F',
    desc: 'Up to four names side by side: totals, peaks, best ranks, trend, estimated age and the yearly series.',
    params: [
      { name: 'names', desc: 'Required. Comma-separated, max 4' },
      { name: 'sex', desc: 'F, M or all (default all)' },
    ],
  },
  {
    path: '/api/years/{year}', title: 'One year', example: '/api/years/1957?limit=5',
    desc: 'Total babies, distinct names, and the top names for girls and boys in a single year.',
    params: [{ name: 'limit', desc: 'Top names per sex, up to 25 (default 5)' }],
  },
  {
    path: '/api/unique', title: 'Unique names', example: '/api/unique?sex=F&starts=el&ends=a&maxLen=6&min=20&max=200&years=10',
    desc: 'Uncommon names filtered by gender, letters and rarity ("given to min–max babies in the last N years"). Powers the Unique names page.',
    params: [
      { name: 'sex', desc: 'F, M, unisex (30–70% girls) or all (default)' },
      { name: 'years', desc: 'Window: 1, 3, 5, 10, 20, 50 or all (default 5)' },
      { name: 'min, max', desc: 'Babies in the window (default 5–100)' },
      { name: 'starts, ends, contains', desc: 'Letters, case-insensitive' },
      { name: 'minLen, maxLen', desc: 'Number of letters, 1–15' },
      { name: 'trend', desc: 'any, rising, steady, falling or new' },
      { name: 'vintage', desc: 'true = once had 1,000+ babies in a year' },
      { name: 'sort', desc: 'rare (default), common, rising, az, za, random (+ seed)' },
    ],
  },
]

export function ApiDocs() {
  const origin = window.location.origin
  return (
    <>
      <section className="section" style={{ paddingTop: 28 }}>
        <h2 className="section-title">A free API for baby name data</h2>
        <p className="section-sub" style={{ maxWidth: 680 }}>
          The same data behind this dashboard, as JSON. No key, no sign-up, CORS enabled, so you can call it from a
          browser, a notebook or your own app. All endpoints are <code>GET</code> and cached at the edge.
        </p>
        <div className="api-links">
          <a className="chip" href={DOCS_URL} target="_blank" rel="noreferrer">Full documentation ↗</a>
          <a className="chip" href="/openapi.json" target="_blank" rel="noreferrer">OpenAPI spec</a>
          <a className="chip" href={REPO_URL} target="_blank" rel="noreferrer">GitHub repo ↗</a>
        </div>
        <pre className="code"><code>curl {origin}/api/names/Olivia?sex=F</code></pre>
      </section>

      {ENDPOINTS.map((e) => <EndpointCard key={e.path} e={e} origin={origin} />)}

      <section className="section">
        <h3 className="section-title">Good to know</h3>
        <ul className="plain-list">
          <li>Data: US Social Security Administration, 1880–2025. Names given to fewer than 5 babies of one sex in a year are not published.</li>
          <li>Ranks are among all names of the same sex that year. Ties share a rank.</li>
          <li>Names are matched case-insensitively (<code>mary</code> = <code>Mary</code>).</li>
          <li>Errors return a JSON body like <code>{'{"error":{"code":"name_not_found","message":"…"}}'}</code> with a 4xx status.</li>
          <li>Please cache responses on your side. The data only changes when SSA publishes a new year.</li>
        </ul>
      </section>
    </>
  )
}

function EndpointCard({ e, origin }: { e: Endpoint; origin: string }) {
  const [out, setOut] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      const r = await fetch(e.example)
      const body = await r.json()
      setOut(`HTTP ${r.status}\n` + JSON.stringify(trim(body), null, 2))
    } catch (err) {
      setOut(String(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="section endpoint">
      <div className="endpoint-head">
        <span className="method">GET</span>
        <code className="path">{e.path}</code>
      </div>
      <h3 className="section-title" style={{ marginTop: 10 }}>{e.title}</h3>
      <p className="section-sub">{e.desc}</p>
      <dl className="params">
        {e.params.map((p) => <div key={p.name}><dt><code>{p.name}</code></dt><dd>{p.desc}</dd></div>)}
      </dl>
      <div className="try">
        <code className="example">{origin}{e.example}</code>
        <button className="chip" onClick={run} disabled={busy}>{busy ? 'Loading…' : out ? 'Run again' : 'Try it'}</button>
      </div>
      {out && <pre className="code response"><code>{out}</code></pre>}
    </section>
  )
}

/** Shorten long arrays so the preview stays readable. */
function trim(v: unknown): unknown {
  if (Array.isArray(v)) return v.length > 6 ? [...v.slice(0, 6).map(trim), `… ${v.length - 6} more`] : v.map(trim)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x)]))
  return v
}
