import { useCallback, useEffect, useState } from 'react'

/** Tiny hash router: #tab?key=value&key2=value2 */
export function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [tab, qs = ''] = raw.split('?')
  return { tab: tab || 'explore', params: new URLSearchParams(qs) }
}

export function useHash() {
  const [state, setState] = useState(parseHash)
  useEffect(() => {
    const on = () => setState(parseHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((tab: string, params?: Record<string, string>, replace = false) => {
    const qs = params ? new URLSearchParams(params).toString() : ''
    const hash = '#' + tab + (qs ? '?' + qs : '')
    if (replace) history.replaceState(null, '', hash)
    else history.pushState(null, '', hash)
    setState(parseHash())
  }, [])
  return { ...state, go }
}
