// GET /api/top?year=2025&sex=F&limit=10&offset=0
import { sql } from './_lib/db.js'
import { FIRST_YEAR, LAST_YEAR, handler, json, parseInt0, parseSex } from './_lib/http.js'

export const GET = handler(async (url) => {
  const year = parseInt0(url.searchParams.get('year'), 'year', FIRST_YEAR, LAST_YEAR, LAST_YEAR)
  const sex = parseSex(url.searchParams.get('sex'), false)!
  const limit = parseInt0(url.searchParams.get('limit'), 'limit', 1, 100, 10)
  const offset = parseInt0(url.searchParams.get('offset'), 'offset', 0, 100000, 0)

  const rows = await sql()`
    SELECT n.name, y.count, y.rank
    FROM name_years y JOIN names n ON n.id = y.name_id
    WHERE y.year = ${year} AND y.sex = ${sex}
    ORDER BY y.rank, n.name
    LIMIT ${limit} OFFSET ${offset}
  `
  const [totals] = await sql()`SELECT births, unique_names FROM year_totals WHERE year = ${year} AND sex = ${sex}`

  return json({
    year,
    sex,
    births: totals?.births ?? 0,
    uniqueNames: totals?.unique_names ?? 0,
    limit,
    offset,
    names: rows.map((r) => ({
      rank: r.rank,
      name: r.name,
      count: r.count,
      sharePct: totals ? Math.round((r.count / totals.births) * 10000) / 100 : null,
    })),
  })
})
