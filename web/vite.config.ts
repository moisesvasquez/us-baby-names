import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const ROOT = path.resolve(__dirname, '..')

/**
 * Serves the Vercel functions in ../api during `npm run dev`, so the dashboard and the API
 * run on one port locally. In production Vercel serves ../api itself.
 */
function apiDev(): Plugin {
  const route = (pathname: string): string | null => {
    const parts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const candidates = parts.length === 0
      ? ['index.ts']
      : [`${parts.join('/')}.ts`, `${parts.join('/')}/index.ts`, `${parts.slice(0, -1).join('/')}/[${parts[0] === 'names' ? 'name' : 'year'}].ts`]
    for (const c of candidates) {
      const file = path.join(ROOT, 'api', c)
      if (!c.startsWith('/') && existsSync(file) && !c.includes('_lib')) return file
    }
    return null
  }
  return {
    name: 'api-dev',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', ROOT, ''))
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next()
        const url = new URL(req.url, 'http://localhost')
        const file = route(url.pathname)
        if (!file) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: { code: 'not_found', message: 'Unknown endpoint. See /api.' } }))
        }
        try {
          const mod = await server.ssrLoadModule(file)
          const response: Response = await mod.GET(new Request(`http://${req.headers.host}${req.url}`, { method: req.method }))
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(await response.text())
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDev()],
})
