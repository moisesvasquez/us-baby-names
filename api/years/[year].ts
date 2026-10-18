// GET /api/years/{year}?limit=5  — totals and top names for one year
import { sql } from '../_lib/db.js'
import { FIRST_YEAR, LAST_YEAR, HttpError, handler, json, lastSegment, parseInt0 } from '../_lib/http.js'

export const GET = handler(async (url) => {
  const seg = url.searchParams.get('year') ?? lastSegment(url)
  const year = Number(seg)
  if (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR) {
    throw new HttpError(400, 'invalid_year', `year must be between ${FIRST_YEAR} and ${LAST_YEAR}.`)
  }
  const limit = parseInt0(url.searchParams.get('limit'), 'limit', 1, 25, 5)

  const totals = await sql()`SELECT sex, births, unique_names FROM year_totals WHERE year = ${year}`
  const top = await sql()`
    SELECT y.sex, n.name, y.count, y.rank
    FROM name_years y JOIN names n ON n.id = y.name_id
    WHERE y.year = ${year} AND y.rank <= ${limit}
    ORDER BY y.sex, y.rank, n.name
  `
  const pick = (s: 'F' | 'M') => {
    const t = totals.find((r) => r.sex === s)
    return {
      births: t?.births ?? 0,
      uniqueNames: t?.unique_names ?? 0,
      top: top.filter((r) => r.sex === s).slice(0, limit).map((r) => ({ rank: r.rank, name: r.name, count: r.count })),
    }
  }
  const female = pick('F'), male = pick('M')
  return json({ year, births: female.births + male.births, female, male })
})

// Vercel routes only exported methods: serve HEAD and CORS preflight with the same handler.
export const HEAD = GET
export const OPTIONS = GET
