// Summary statistics shared by /names and /compare. Mirrors web/src/lib/stats.ts.
import { LAST_YEAR, type Sex } from './http.js'
import type { YearRow } from './db.js'

// Gompertz–Makeham survival fit to recent US period life tables (approximate).
const GM = { F: { A: 0.0004, B: 0.000012, c: 0.1 }, M: { A: 0.0008, B: 0.00003, c: 0.093 } }
const survival = (age: number, sex: Sex) => {
  const { A, B, c } = GM[sex]
  return Math.exp(-(A * age + (B / c) * (Math.exp(c * age) - 1)))
}

/** Estimated mean/median age of living people with the name, as of the year after the latest data. */
export function estimatedAge(rows: YearRow[]) {
  const ref = LAST_YEAR + 1
  const byAge = new Map<number, number>()
  for (const r of rows) {
    const age = ref - r.year
    byAge.set(age, (byAge.get(age) ?? 0) + r.count * survival(age, r.sex))
  }
  const dist = [...byAge.entries()].sort((a, b) => a[0] - b[0])
  const living = dist.reduce((s, [, p]) => s + p, 0)
  if (living < 1) return null
  const mean = dist.reduce((s, [a, p]) => s + a * p, 0) / living
  let acc = 0, median = 0
  for (const [a, p] of dist) { acc += p; if (acc >= living / 2) { median = a; break } }
  return { mean: Math.round(mean * 10) / 10, median, estimatedLiving: Math.round(living) }
}

export function summarize(rows: YearRow[], sex: Sex) {
  const own = rows.filter((r) => r.sex === sex)
  if (!own.length) return null
  const total = own.reduce((s, r) => s + r.count, 0)
  const peak = own.reduce((a, b) => (b.count > a.count ? b : a))
  const best = own.reduce((a, b) => (b.rank < a.rank || (b.rank === a.rank && b.year < a.year) ? b : a))
  const latest = own.find((r) => r.year === LAST_YEAR)
  return {
    total,
    firstYear: own[0].year,
    lastYear: own[own.length - 1].year,
    peak: { year: peak.year, count: peak.count },
    bestRank: { rank: best.rank, year: best.year },
    latest: latest ? { year: latest.year, count: latest.count, rank: latest.rank } : null,
    trend: trend(own),
    estimatedAge: estimatedAge(own),
  }
}

/** % change in babies over the last five years of data. */
function trend(own: YearRow[]) {
  const from = own.find((r) => r.year === LAST_YEAR - 5)?.count ?? 0
  const to = own.find((r) => r.year === LAST_YEAR)?.count ?? 0
  const pct = from && to ? Math.round(((to - from) / from) * 1000) / 10 : null
  const direction = !from && !to ? 'none' : !from ? 'new' : !to ? 'gone' : pct! > 10 ? 'rising' : pct! < -10 ? 'falling' : 'steady'
  return { from: LAST_YEAR - 5, to: LAST_YEAR, changePct: pct, direction }
}

/** Year series. With a sex: count + rank. Without: combined count plus the female/male split. */
export function series(rows: YearRow[], sex: Sex | null) {
  if (sex) return rows.filter((r) => r.sex === sex).map((r) => ({ year: r.year, count: r.count, rank: r.rank }))
  const by = new Map<number, { year: number; count: number; female: number; male: number }>()
  for (const r of rows) {
    const e = by.get(r.year) ?? { year: r.year, count: 0, female: 0, male: 0 }
    e.count += r.count
    if (r.sex === 'F') e.female = r.count
    else e.male = r.count
    by.set(r.year, e)
  }
  return [...by.values()]
}
