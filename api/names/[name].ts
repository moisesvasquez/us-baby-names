// GET /api/names/{name}?sex=F|M|all&from=1880&to=2025
import { findName, yearRows } from '../_lib/db.js'
import { FIRST_YEAR, HttpError, LAST_YEAR, handler, json, lastSegment, parseInt0, parseName, parseSex } from '../_lib/http.js'
import { estimatedAge, series, summarize } from '../_lib/stats.js'

export const GET = handler(async (url) => {
  const name = parseName(url.searchParams.get('name') ?? lastSegment(url))
  const sex = parseSex(url.searchParams.get('sex'))
  const from = parseInt0(url.searchParams.get('from'), 'from', FIRST_YEAR, LAST_YEAR, FIRST_YEAR)
  const to = parseInt0(url.searchParams.get('to'), 'to', FIRST_YEAR, LAST_YEAR, LAST_YEAR)
  if (from > to) throw new HttpError(400, 'invalid_range', 'from must be less than or equal to to.')

  const row = await findName(name)
  if (!row) throw new HttpError(404, 'name_not_found', `No records for "${name}". SSA data only lists names given to at least 5 babies of one sex in a year.`)

  // Summaries always use the full history; the series honours from/to.
  const all = await yearRows(row.id, FIRST_YEAR, LAST_YEAR)
  const inRange = all.filter((r) => r.year >= from && r.year <= to)
  if (sex && !all.some((r) => r.sex === sex)) {
    throw new HttpError(404, 'name_not_found', `No ${sex === 'F' ? 'girls' : 'boys'} named ${row.name} in the records.`)
  }

  return json({
    name: row.name,
    sex: sex ?? 'all',
    totals: { female: row.total_f, male: row.total_m, all: row.total_f + row.total_m },
    female: summarize(all, 'F'),
    male: summarize(all, 'M'),
    estimatedAge: estimatedAge(sex ? all.filter((r) => r.sex === sex) : all),
    range: { from, to },
    years: series(inRange, sex),
  })
})
