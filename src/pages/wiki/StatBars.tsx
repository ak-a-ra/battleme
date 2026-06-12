interface Props {
  stats: {
    str_stat: number
    agi: number
    dex: number
    int_stat: number
    luck: number
  }
  max?: number
}

const LABELS: { key: keyof Props['stats']; label: string }[] = [
  { key: 'str_stat', label: 'STR' },
  { key: 'agi',      label: 'AGI' },
  { key: 'dex',      label: 'DEX' },
  { key: 'int_stat', label: 'INT' },
  { key: 'luck',     label: 'LUK' },
]

/// Reusable stat bars — shows STR/AGI/DEX/INT/LUCK as blue bars.
export default function StatBars({ stats, max = 25 }: Props) {
  return (
    <div className="space-y-2">
      {LABELS.map(({ key, label }) => {
        const value = stats[key]
        const pct = Math.min(100, (value / max) * 100)
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-8 text-zinc-400 font-mono">{label}</span>
            <div className="flex-1 h-3 bg-zinc-700 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-zinc-300 font-mono text-xs">{value}</span>
          </div>
        )
      })}
    </div>
  )
}
