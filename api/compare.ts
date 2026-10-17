// GET /api/compare?names=Emma,Olivia,Ava&sex=F   (up to 4 names)
import { sql, type YearRow } from './_lib/db.js'
import { HttpError, handler, json, parseName, parseSex } from './_lib/http.js'
import { estimatedAge, series, summarize } from './_lib/stats.js'

const MAX_NAMES = 4

export const GET = handler(async (url) => {
  const raw = (url.searchParams.get('names') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!raw.length) throw new HttpError(400, 'invalid_names', 'Pass names as a comma-separated list, e.g. names=Emma,Olivia.')
  if (raw.length > MAX_NAMES) throw new HttpError(400, 'too_many_names', `Compare at most ${MAX_NAMES} names at a time.`)
  const names = [...new Set(raw.map(parseName).map((n) => n.toLowerCase()))]
  const sex = parseSex(url.searchParams.get('sex'))

  const rows = (await sql()`
    SELECT n.name, n.name_lc, y.sex, y.year, y.count, y.rank
    FROM names n JOIN name_years y ON y.name_id = n.id
    WHERE n.name_lc = ANY(${names})
    ORDER BY y.year
  `) as (YearRow & { name: string; name_lc: string })[]

  const results = names.map((lc) => {
    const own = rows.filter((r) => r.name_lc === lc)
    const scoped = sex ? own.filter((r) => r.sex === sex) : own
    if (!scoped.length) return { name: lc, found: false }
    const summary = sex ? summarize(own, sex) : null
    return {
      name: own[0].name,
      found: true,
      total: scoped.reduce((s, r) => s + r.count, 0),
      peak: sex ? summary!.peak : peakOf(series(own, null)),
      bestRank: summary?.bestRank ?? null,
      latest: summary?.latest ?? null,
      trend: summary?.trend ?? null,
      estimatedAge: estimatedAge(scoped),
      years: series(own, sex),
    }
  })

  return json({ sex: sex ?? 'all', names: results })
})

function peakOf(s: { year: number; count: number }[]) {
  const p = s.reduce((a, b) => (b.count > a.count ? b : a))
  return { year: p.year, count: p.count }
}
