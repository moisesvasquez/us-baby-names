// GET /api/unique — find uncommon names.
// ?sex=F|M|unisex|all &years=5 &min=5 &max=100 &minLen=&maxLen= &starts=&ends=&contains=
// &trend=any|rising|steady|falling|new &vintage=true &sort=rare|common|az|za|rising|random &seed= &limit=50 &offset=0
import { sql } from './_lib/db.js'
import { HttpError, LAST_YEAR, handler, json, parseInt0 } from './_lib/http.js'

export const WINDOWS = [1, 3, 5, 10, 20, 50, 146] as const
const ALL_YEARS = 146
const VINTAGE_PEAK = 1000

const SORTS: Record<string, string> = {
  rare: 'tot ASC, n.name ASC',
  common: 'tot DESC, n.name ASC',
  az: 'n.name ASC',
  za: 'n.name DESC',
  rising: 'ratio DESC NULLS LAST, tot DESC, n.name ASC',
  random: 'md5(n.name || $seed) ASC',
}

function letters(v: string | null, name: string): string | null {
  const s = (v ?? '').trim()
  if (!s) return null
  if (!/^[A-Za-z]{1,15}$/.test(s)) throw new HttpError(400, `invalid_${name}`, `${name} must be 1–15 letters A–Z.`)
  return s.toLowerCase()
}

export const GET = handler(async (url) => {
  const q = url.searchParams
  const sexRaw = (q.get('sex') ?? 'all').toLowerCase()
  if (!['f', 'm', 'unisex', 'all'].includes(sexRaw)) throw new HttpError(400, 'invalid_sex', 'sex must be F, M, unisex or all.')
  const sex = sexRaw === 'f' ? 'F' : sexRaw === 'm' ? 'M' : sexRaw

  const yearsRaw = q.get('years') ?? '5'
  const years = yearsRaw === 'all' ? ALL_YEARS : Number(yearsRaw)
  if (!WINDOWS.includes(years as (typeof WINDOWS)[number])) {
    throw new HttpError(400, 'invalid_years', `years must be one of ${WINDOWS.slice(0, -1).join(', ')} or all.`)
  }
  const min = parseInt0(q.get('min'), 'min', 0, 10_000_000, 5)
  const max = parseInt0(q.get('max'), 'max', 1, 10_000_000, 100)
  if (min > max) throw new HttpError(400, 'invalid_range', 'min must be less than or equal to max.')
  const minLen = parseInt0(q.get('minLen'), 'minLen', 1, 15, 1)
  const maxLen = parseInt0(q.get('maxLen'), 'maxLen', 1, 15, 15)
  if (minLen > maxLen) throw new HttpError(400, 'invalid_length', 'minLen must be less than or equal to maxLen.')
  const starts = letters(q.get('starts'), 'starts')
  const ends = letters(q.get('ends'), 'ends')
  const contains = letters(q.get('contains'), 'contains')
  const trend = (q.get('trend') ?? 'any').toLowerCase()
  if (!['any', 'rising', 'steady', 'falling', 'new'].includes(trend)) throw new HttpError(400, 'invalid_trend', 'trend must be any, rising, steady, falling or new.')
  if (trend !== 'any' && trend !== 'new' && years < 3) throw new HttpError(400, 'invalid_trend', 'Rising/steady/falling need a window of at least 3 years.')
  const vintage = q.get('vintage') === 'true' || q.get('vintage') === '1'
  const sort = (q.get('sort') ?? 'rare').toLowerCase()
  if (!SORTS[sort]) throw new HttpError(400, 'invalid_sort', `sort must be one of ${Object.keys(SORTS).join(', ')}.`)
  const seed = (q.get('seed') ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || 'seed'
  const limit = parseInt0(q.get('limit'), 'limit', 1, 100, 50)
  const offset = parseInt0(q.get('offset'), 'offset', 0, 100_000, 0)

  // Build the query with numbered parameters.
  const params: unknown[] = []
  const p = (v: unknown) => { params.push(v); return `$${params.length}` }

  const tot = sex === 'F' ? 'w.total_f' : sex === 'M' ? 'w.total_m' : '(w.total_f + w.total_m)'
  const rec = sex === 'F' ? 'w.recent_f' : sex === 'M' ? 'w.recent_m' : '(w.recent_f + w.recent_m)'
  const peak = sex === 'F' ? 'n.peak_f' : sex === 'M' ? 'n.peak_m' : 'GREATEST(n.peak_f, n.peak_m)'
  const half = Math.floor(years / 2)
  const early = years - half
  // Per-year rate in the newer half of the window vs the older half. NULL when it can't be compared.
  const ratio = years >= 3
    ? `CASE WHEN (${tot} - ${rec}) > 0 THEN (${rec}::float / ${half}) / ((${tot} - ${rec})::float / ${early}) END`
    : 'NULL::float'

  const where = [
    `w.window_years = ${p(years)}`,
    `${tot} BETWEEN ${p(min)} AND ${p(max)}`,
    `length(n.name) BETWEEN ${p(minLen)} AND ${p(maxLen)}`,
  ]
  if (sex === 'F') where.push('w.total_f > 0')
  if (sex === 'M') where.push('w.total_m > 0')
  if (sex === 'unisex') where.push('w.total_f BETWEEN 0.3 * (w.total_f + w.total_m) AND 0.7 * (w.total_f + w.total_m)')
  if (starts) where.push(`n.name_lc LIKE ${p(starts + '%')}`)
  if (ends) where.push(`n.name_lc LIKE ${p('%' + ends)}`)
  if (contains) where.push(`n.name_lc LIKE ${p('%' + contains + '%')}`)
  if (vintage) where.push(`${peak} >= ${VINTAGE_PEAK}`)
  if (trend === 'new') where.push(`n.first_year > ${p(LAST_YEAR - years)}`)
  if (trend === 'rising') where.push(`(${tot} - ${rec}) > 0 AND ${ratio} > 1.25`)
  if (trend === 'falling') where.push(`(${tot} - ${rec}) > 0 AND ${ratio} < 0.8`)
  if (trend === 'steady') where.push(`(${tot} - ${rec}) > 0 AND ${ratio} BETWEEN 0.8 AND 1.25`)

  const order = sort === 'random' ? SORTS.random.replace('$seed', p(seed)) : SORTS[sort]
  const text = `
    SELECT n.name, ${tot} AS tot, w.total_f, w.total_m, ${ratio} AS ratio, ${peak} AS peak,
           n.first_year, GREATEST(w.years_f, w.years_m) AS years_used, count(*) OVER () AS matches
    FROM name_windows w JOIN names n ON n.id = w.name_id
    WHERE ${where.join(' AND ')}
    ORDER BY ${order}
    LIMIT ${p(limit)} OFFSET ${p(offset)}`

  const rows = await sql().query(text, params)

  return json({
    filters: {
      sex,
      years: years === ALL_YEARS ? 'all' : years,
      from: LAST_YEAR - years + 1,
      to: LAST_YEAR,
      min, max, minLen, maxLen, starts, ends, contains, trend, vintage, sort,
      ...(sort === 'random' ? { seed } : {}),
    },
    matches: rows.length ? Number(rows[0].matches) : 0,
    limit,
    offset,
    names: rows.map((r) => ({
      name: r.name,
      count: Number(r.tot),
      female: Number(r.total_f),
      male: Number(r.total_m),
      yearsUsed: Number(r.years_used),
      firstYear: r.first_year,
      peakYearCount: Number(r.peak),
      ...withTrend(r.ratio, r.first_year, years),
    })),
  })
})

/** Trend label plus % change in yearly rate, newer half of the window vs older half. */
function withTrend(ratio: number | null, firstYear: number, years: number) {
  if (firstYear > LAST_YEAR - years) return { trend: 'new', changePct: null }
  if (ratio == null) return { trend: years < 3 ? null : 'new', changePct: null }
  const r = Number(ratio)
  return {
    trend: r > 1.25 ? 'rising' : r < 0.8 ? 'falling' : 'steady',
    changePct: Math.round((r - 1) * 1000) / 10,
  }
}

// Vercel routes only exported methods: serve HEAD and CORS preflight with the same handler.
export const HEAD = GET
export const OPTIONS = GET
