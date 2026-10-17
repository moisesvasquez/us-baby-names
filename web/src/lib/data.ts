// Loaders for the static JSON produced by scripts/build_data.py. Everything is cached per session.

export type Sex = 'F' | 'M' | 'B'
/** [firstYear, counts[], ranks[]] — 0 means absent that year */
export type Compact = [number, number[], number[]]
export type NameRecord = Partial<Record<Sex, Compact>>
export type IndexRow = [name: string, totalF: number, totalM: number]

export interface Meta {
  firstYear: number
  lastYear: number
  births: { F: number[]; M: number[] }
  uniqueNames: { F: number[]; M: number[] }
  nameCount: number
}

export interface Mover { name: string; r0: number | null; r1: number | null; n0: number; n1: number; pct: number | null }
export interface Recent {
  years: number[]
  baseYear: number
  topF: { name: string; ranks: (number | null)[]; counts: number[] }[]
  topM: { name: string; ranks: (number | null)[]; counts: number[] }[]
  top10_F: string[]
  top10_M: string[]
  risingF: Mover[]; risingM: Mover[]
  fallingF: Mover[]; fallingM: Mover[]
  newF: Mover[]; newM: Mover[]
  concentrationF: { year: number; top10: number; top100: number }[]
  concentrationM: { year: number; top10: number; top100: number }[]
  neutral: { name: string; F: number; M: number }[]
  births: { year: number; F: number; M: number }[]
  unique: { year: number; F: number; M: number }[]
}

export interface Story {
  name: string; sex: 'F' | 'M'; year: number; from: number; to: number
  category: string; title: string; text: string; series: [number, number][]
}
export interface Surge { name: string; sex: 'F' | 'M'; year: number; before: number; count: number; factor: number; tenYearsLater: number | null }

const BASE = import.meta.env.BASE_URL + 'data/'
const cache = new Map<string, Promise<unknown>>()

function get<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`Failed to load ${path}`)
      return r.json()
    }).catch((e) => { cache.delete(path); throw e }))
  }
  return cache.get(path) as Promise<T>
}

export const loadMeta = () => get<Meta>('meta.json')
export const loadIndex = () => get<IndexRow[]>('index.json')
export const loadRecent = () => get<Recent>('recent.json')
export const loadStories = () => get<{ stories: Story[]; surges: Surge[] }>('stories.json')

/** Exact-case name lookup. Returns null when the name never appears in the data. */
export async function loadName(name: string): Promise<NameRecord | null> {
  const key = name.slice(0, 2).toLowerCase()
  try {
    const shard = await get<Record<string, NameRecord>>(`names/${key}.json`)
    return shard[name] ?? null
  } catch {
    return null
  }
}

/** Resolve user input ("mARY ") to the canonical spelling in the index. */
export async function resolveName(input: string): Promise<string | null> {
  const q = input.trim().toLowerCase()
  if (!q) return null
  const index = await loadIndex()
  return index.find((r) => r[0].toLowerCase() === q)?.[0] ?? null
}
