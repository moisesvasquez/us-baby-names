import { useEffect, useState } from 'react'
import { loadMeta, type Meta, type Sex } from './lib/data'
import { compact, fmt } from './lib/format'
import { useHash } from './lib/useHash'
import { Explore } from './tabs/Explore'
import { Compare, MAX_COMPARE } from './tabs/Compare'
import { Recent } from './tabs/Recent'
import { Stories } from './tabs/Stories'
import { ApiDocs, REPO_URL } from './tabs/ApiDocs'

const TABS = [
  { id: 'explore', label: 'Look up' },
  { id: 'compare', label: 'Compare' },
  { id: 'recent', label: 'Last 5 years' },
  { id: 'stories', label: 'Stories' },
  { id: 'api', label: 'API' },
]

const asSex = (v: string | null, fallback: Sex): Sex => (v === 'F' || v === 'M' || v === 'B' ? v : fallback)

export default function App() {
  const { tab, params, go } = useHash()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => {
    try { return (localStorage.getItem('theme') as 'light' | 'dark' | null) } catch { return null }
  })
  useEffect(() => { loadMeta().then(setMeta) }, [])
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    try { if (theme) localStorage.setItem('theme', theme) } catch { /* storage unavailable */ }
  }, [theme])

  const isDark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  const active = TABS.some((t) => t.id === tab) ? tab : 'explore'
  const pick = (name: string, sex: Sex) => { go('explore', { name, sex }); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const totalBabies = meta ? meta.births.F.reduce((a, b) => a + b, 0) + meta.births.M.reduce((a, b) => a + b, 0) : 0

  return (
    <div className="page">
      <header className="masthead">
        <button className="theme-toggle" onClick={() => setTheme(isDark ? 'light' : 'dark')}>{isDark ? 'Light' : 'Dark'} mode</button>
        <h1>{meta ? meta.lastYear - meta.firstYear + 1 : 146} years of American baby names</h1>
        <p>
          Every name given to at least five US babies in a year, {meta?.firstYear ?? 1880}–{meta?.lastYear ?? 2025}:
          {meta ? ` ${compact(totalBabies)} babies and ${fmt(meta.nameCount)} different names` : ' loading…'}, from Social Security card applications.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="tab" aria-selected={active === t.id} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {active === 'explore' && (
          <Explore name={params.get('name') ?? ''} sex={asSex(params.get('sex'), 'B')}
            onChange={(name, sex) => go('explore', { name, sex }, true)} />
        )}
        {active === 'compare' && (
          <Compare
            names={(params.get('names') ?? '').split(',').filter(Boolean).slice(0, MAX_COMPARE)}
            sex={asSex(params.get('sex'), 'B')}
            onChange={(names, sex) => go('compare', names.length ? { names: names.join(','), sex } : { sex }, true)} />
        )}
        {active === 'recent' && <Recent onPick={pick} />}
        {active === 'stories' && <Stories onPick={pick} />}
        {active === 'api' && <ApiDocs />}
      </main>

      <footer className="footer">
        <p className="note">
          Source: US Social Security Administration, national baby name data (yob1880–yob{meta?.lastYear ?? 2025}). Names given to fewer than 5 babies of one sex
          in a year are not published. Ranks are among all names of the same sex that year (or both sexes combined). Average age is an estimate:
          births adjusted with an approximate US life table, ignoring migration.
        </p>
        <div className="footer-bottom">
        <p className="note credit">
          Made with <span role="img" aria-label="love">❤️</span> by{' '}
          <a href="https://moisesvasquez.io" target="_blank" rel="noreferrer">Moises Vasquez</a>.
        </p>
        <p className="note">Open source on <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a> · <a href="#api" onClick={(e) => { e.preventDefault(); go('api') }}>Free API</a></p>
        </div>
      </footer>
    </div>
  )
}

