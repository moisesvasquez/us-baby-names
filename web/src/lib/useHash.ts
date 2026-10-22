import { useCallback, useEffect, useState } from 'react'

/** Paths that are their own page (not a hash tab). */
const PATH_ROUTES: Record<string, string> = { '/unique-names': 'unique' }
const ROUTE_PATHS: Record<string, string> = Object.fromEntries(Object.entries(PATH_ROUTES).map(([p, t]) => [t, p]))

/**
 * Tiny router. Most tabs live in the hash (#tab?key=value); some pages have their own path
 * (/unique-names?key=value) so they can be shared and indexed as a URL of their own.
 */
export function parseHash() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (PATH_ROUTES[path]) return { tab: PATH_ROUTES[path], params: new URLSearchParams(window.location.search) }
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [tab, qs = ''] = raw.split('?')
  return { tab: tab || 'explore', params: new URLSearchParams(qs) }
}

export function useHash() {
  const [state, setState] = useState(parseHash)
  useEffect(() => {
    const on = () => setState(parseHash())
    window.addEventListener('hashchange', on)
    window.addEventListener('popstate', on)
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('popstate', on) }
  }, [])
  const go = useCallback((tab: string, params?: Record<string, string>, replace = false) => {
    const qs = params ? new URLSearchParams(params).toString() : ''
    const url = ROUTE_PATHS[tab] ? ROUTE_PATHS[tab] + (qs ? '?' + qs : '') : '/#' + tab + (qs ? '?' + qs : '')
    if (replace) history.replaceState(null, '', url)
    else history.pushState(null, '', url)
    setState(parseHash())
  }, [])
  return { ...state, go }
}
