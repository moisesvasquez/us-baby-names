import type { Sex } from '../lib/data'

/** Female / Male checkboxes. Both checked = combined counts. At least one stays checked. */
export function SexFilter({ value, onChange }: { value: Sex; onChange: (s: Sex) => void }) {
  const f = value === 'F' || value === 'B'
  const m = value === 'M' || value === 'B'
  const set = (nf: boolean, nm: boolean) => {
    if (!nf && !nm) return
    onChange(nf && nm ? 'B' : nf ? 'F' : 'M')
  }
  return (
    <div className="checks" role="group" aria-label="Sex filter">
      <label><input type="checkbox" checked={f} onChange={(e) => set(e.target.checked, m)} /> Female</label>
      <label><input type="checkbox" checked={m} onChange={(e) => set(f, e.target.checked)} /> Male</label>
      <span className="hint">{value === 'B' ? 'Showing both combined' : value === 'F' ? 'Girls only' : 'Boys only'}</span>
    </div>
  )
}
