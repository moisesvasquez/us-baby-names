import { useEffect, useMemo, useRef, useState } from 'react'
import { loadIndex, type IndexRow, type Sex } from '../lib/data'
import { compact } from '../lib/format'

interface Props {
  onPick: (name: string) => void
  sex: Sex
  placeholder?: string
  clearOnPick?: boolean
  initial?: string
}

export function NameSearch({ onPick, sex, placeholder = 'Search a name…', clearOnPick, initial = '' }: Props) {
  const [index, setIndex] = useState<IndexRow[]>([])
  const [q, setQ] = useState(initial)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { loadIndex().then(setIndex) }, [])
  useEffect(() => { setQ(initial) }, [initial])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const total = (r: IndexRow) => (sex === 'F' ? r[1] : sex === 'M' ? r[2] : r[1] + r[2])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const out: IndexRow[] = []
    // index is sorted by overall popularity, so the first hits are the useful ones
    for (const r of index) {
      if (total(r) > 0 && r[0].toLowerCase().startsWith(s)) {
        out.push(r)
        if (out.length === 8) break
      }
    }
    return out
  }, [q, index, sex])

  function choose(name: string) {
    setOpen(false)
    setError('')
    setQ(clearOnPick ? '' : name)
    onPick(name)
  }

  function submit() {
    const s = q.trim().toLowerCase()
    if (!s) return
    const exact = index.find((r) => r[0].toLowerCase() === s)
    if (exact) choose(exact[0])
    else if (matches[active]) choose(matches[active][0])
    else setError(`No records for “${q.trim()}”. SSA data lists names given to at least 5 babies in a year.`)
  }

  return (
    <div className="search" ref={ref}>
      <label className="sr-only" htmlFor="name-search">Name</label>
      <input
        id="name-search"
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls="name-suggest"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); setError('') }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter') {
            e.preventDefault()
            if (open && matches[active] && matches[active][0].toLowerCase() !== q.trim().toLowerCase()) choose(matches[active][0])
            else submit()
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && matches.length > 0 && (
        <ul className="suggest" id="name-suggest" role="listbox">
          {matches.map((r, i) => (
            <li key={r[0]} role="option" aria-selected={i === active}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(r[0]) }}>
              <span>{r[0]}</span>
              <span className="n">{compact(total(r))} total</span>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="err">{error}</div>}
    </div>
  )
}
