import type { Metric } from './TrendChart'

const OPTIONS: [Metric, string][] = [['count', 'Babies'], ['perMillion', 'Per million'], ['rank', 'Rank']]

export function MetricToggle({ value, onChange }: { value: Metric; onChange: (m: Metric) => void }) {
  return (
    <div className="seg" role="group" aria-label="Chart metric">
      {OPTIONS.map(([k, l]) => (
        <button key={k} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  )
}
