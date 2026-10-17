// GET /api/search?q=mar&sex=F&limit=10  — prefix search, most popular first
import { sql } from './_lib/db.js'
import { HttpError, handler, json, parseInt0, parseSex } from './_lib/http.js'

export const GET = handler(async (url) => {
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!/^[A-Za-z]{1,15}$/.test(q)) throw new HttpError(400, 'invalid_query', 'q must be 1–15 letters A–Z.')
  const sex = parseSex(url.searchParams.get('sex'))
  const limit = parseInt0(url.searchParams.get('limit'), 'limit', 1, 50, 10)
  const prefix = q.toLowerCase() + '%'

  const rows = sex === 'F'
    ? await sql()`SELECT name, total_f, total_m, first_year, last_year FROM names WHERE name_lc LIKE ${prefix} AND total_f > 0 ORDER BY total_f DESC LIMIT ${limit}`
    : sex === 'M'
      ? await sql()`SELECT name, total_f, total_m, first_year, last_year FROM names WHERE name_lc LIKE ${prefix} AND total_m > 0 ORDER BY total_m DESC LIMIT ${limit}`
      : await sql()`SELECT name, total_f, total_m, first_year, last_year FROM names WHERE name_lc LIKE ${prefix} ORDER BY total DESC LIMIT ${limit}`

  return json({
    query: q,
    sex: sex ?? 'all',
    results: rows.map((r) => ({
      name: r.name,
      totals: { female: r.total_f, male: r.total_m, all: r.total_f + r.total_m },
      firstYear: r.first_year,
      lastYear: r.last_year,
    })),
  })
})
