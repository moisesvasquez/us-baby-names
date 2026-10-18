// GET /api — discovery document
import { DOCS_URL, FIRST_YEAR, LAST_YEAR, handler, json } from './_lib/http.js'

export const GET = handler(async (url) => {
  const base = `${url.origin}/api`
  return json({
    name: 'US Baby Names API',
    description: `Free, read-only access to US baby name counts and ranks from the Social Security Administration, ${FIRST_YEAR}–${LAST_YEAR}.`,
    docs: DOCS_URL,
    openapi: `${url.origin}/openapi.json`,
    endpoints: {
      name: `${base}/names/{name}?sex=F|M|all&from=${FIRST_YEAR}&to=${LAST_YEAR}`,
      top: `${base}/top?year=${LAST_YEAR}&sex=F&limit=10`,
      search: `${base}/search?q=ma&sex=all&limit=10`,
      compare: `${base}/compare?names=Emma,Olivia&sex=F`,
      year: `${base}/years/{year}?limit=5`,
    },
    source: 'https://www.ssa.gov/oact/babynames/limits.html',
  })
})

// Vercel routes only exported methods: serve HEAD and CORS preflight with the same handler.
export const HEAD = GET
export const OPTIONS = GET
