import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { HttpError } from './http.js'

let client: NeonQueryFunction<false, false> | null = null

/** Neon serverless SQL client (HTTP). Reused across invocations of a warm function. */
export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new HttpError(500, 'not_configured', 'DATABASE_URL is not set on the server.')
    client = neon(url)
  }
  return client
}

export interface YearRow { sex: 'F' | 'M'; year: number; count: number; rank: number }
export interface NameRow { id: number; name: string; total_f: number; total_m: number; first_year: number; last_year: number }

/** Case-insensitive name lookup. Returns null when the name is not in the data. */
export async function findName(name: string): Promise<NameRow | null> {
  const rows = (await sql()`
    SELECT id, name, total_f, total_m, first_year, last_year
    FROM names WHERE name_lc = ${name.toLowerCase()}
  `) as NameRow[]
  return rows[0] ?? null
}

export async function yearRows(nameId: number, from: number, to: number): Promise<YearRow[]> {
  return (await sql()`
    SELECT sex, year, count, rank FROM name_years
    WHERE name_id = ${nameId} AND year BETWEEN ${from} AND ${to}
    ORDER BY year, sex
  `) as YearRow[]
}
