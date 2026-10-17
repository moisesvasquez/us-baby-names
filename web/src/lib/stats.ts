import type { Compact, Meta, NameRecord, Sex } from './data'

export interface Point { year: number; count: number; rank: number | null; perMillion: number }

export interface Summary {
  total: number
  peak: { year: number; count: number }
  best: { rank: number; year: number; yearsAtBest: number }
  latest: { year: number; count: number; rank: number | null }
  trend: { pct: number | null; label: 'Rising' | 'Falling' | 'Steady' | 'New' | 'Gone'; from: number; to: number }
  age: { mean: number; median: number; living: number } | null
  firstYear: number
}

export const TREND_SPAN = 5

/** Pick the record for a sex selection; "both" uses the combined (B) record. */
export function pick(record: NameRecord, sex: Sex): Compact | undefined {
  return record[sex]
}

export function births(meta: Meta, sex: Sex, year: number): number {
  const i = year - meta.firstYear
  if (sex === 'F') return meta.births.F[i]
  if (sex === 'M') return meta.births.M[i]
  return meta.births.F[i] + meta.births.M[i]
}

/** Full 1880..lastYear series with zeros where the name is absent. */
export function series(record: NameRecord, sex: Sex, meta: Meta): Point[] {
  const c = pick(record, sex)
  const out: Point[] = []
  for (let y = meta.firstYear; y <= meta.lastYear; y++) {
    let count = 0
    let rank: number | null = null
    if (c) {
      const i = y - c[0]
      if (i >= 0 && i < c[1].length && c[1][i] > 0) {
        count = c[1][i]
        rank = c[2][i]
      }
    }
    out.push({ year: y, count, rank, perMillion: (count / births(meta, sex, y)) * 1e6 })
  }
  return out
}

// ---- Survival model for "average age of a living person with this name" ----
// Gompertz–Makeham fit to recent US period life tables (approximate):
// S(a) = exp(-(A·a + B/c·(e^{c·a} − 1)))
const GM = {
  F: { A: 0.0004, B: 0.000012, c: 0.1 },
  M: { A: 0.0008, B: 0.00003, c: 0.093 },
}
export function survival(age: number, sex: 'F' | 'M'): number {
  const { A, B, c } = GM[sex]
  return Math.exp(-(A * age + (B / c) * (Math.exp(c * age) - 1)))
}

/** Estimated number of people alive today by age. Uses F and M separately even for "both". */
export function livingByAge(record: NameRecord, sex: Sex, meta: Meta): { age: number; people: number }[] {
  const refYear = meta.lastYear + 1
  const sexes: ('F' | 'M')[] = sex === 'B' ? ['F', 'M'] : [sex]
  const byAge = new Map<number, number>()
  for (const s of sexes) {
    const c = record[s]
    if (!c) continue
    c[1].forEach((n, i) => {
      if (!n) return
      const age = refYear - (c[0] + i)
      byAge.set(age, (byAge.get(age) ?? 0) + n * survival(age, s))
    })
  }
  return [...byAge.entries()].map(([age, people]) => ({ age, people })).sort((a, b) => a.age - b.age)
}

export function ageStats(record: NameRecord, sex: Sex, meta: Meta) {
  const dist = livingByAge(record, sex, meta)
  const living = dist.reduce((s, d) => s + d.people, 0)
  if (living < 1) return null
  const mean = dist.reduce((s, d) => s + d.age * d.people, 0) / living
  let acc = 0
  let median = 0
  for (const d of dist) {
    acc += d.people
    if (acc >= living / 2) { median = d.age; break }
  }
  return { mean, median, living }
}

export function summarize(record: NameRecord, sex: Sex, meta: Meta): Summary | null {
  const pts = series(record, sex, meta)
  const present = pts.filter((p) => p.count > 0)
  if (!present.length) return null

  const total = present.reduce((s, p) => s + p.count, 0)
  const peakPt = present.reduce((a, b) => (b.count > a.count ? b : a))
  const ranked = present.filter((p) => p.rank != null)
  const bestRank = Math.min(...ranked.map((p) => p.rank!))
  const atBest = ranked.filter((p) => p.rank === bestRank)
  const last = pts[pts.length - 1]
  const from = pts[pts.length - 1 - TREND_SPAN]

  let label: Summary['trend']['label'] = 'Steady'
  let pct: number | null = null
  if (!from.count && !last.count) label = 'Gone'
  else if (!from.count && last.count) label = 'New'
  else if (from.count && !last.count) label = 'Gone'
  else if (from.count && last.count) {
    // compare share of births so a shrinking birth cohort doesn't read as decline
    pct = (last.perMillion / from.perMillion - 1) * 100
    label = pct > 10 ? 'Rising' : pct < -10 ? 'Falling' : 'Steady'
  }

  return {
    total,
    peak: { year: peakPt.year, count: peakPt.count },
    best: { rank: bestRank, year: atBest[0].year, yearsAtBest: atBest.length },
    latest: { year: last.year, count: last.count, rank: last.rank },
    trend: { pct, label, from: from.year, to: last.year },
    age: ageStats(record, sex, meta),
    firstYear: present[0].year,
  }
}
