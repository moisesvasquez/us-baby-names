const nf = new Intl.NumberFormat('en-US')
export const fmt = (n: number) => nf.format(Math.round(n))

export function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K'
  return String(Math.round(n))
}

export const pct = (n: number | null, digits = 0) =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`

export const sexLabel = { F: 'girls', M: 'boys', B: 'babies' } as const
