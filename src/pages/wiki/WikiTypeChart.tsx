import { useEffect, useState } from 'react'
import { api } from '../../lib/invoke'

interface TypeCell {
  attacker: string
  defender: string
  multiplier: number
}

const TYPES = ['Fire', 'Water', 'Earth', 'Wind', 'Dark', 'Light']

export default function WikiTypeChart() {
  const [chart, setChart] = useState<TypeCell[]>([])

  useEffect(() => {
    api.getTypeChart().then(setChart).catch(() => {})
  }, [])

  const getMultiplier = (attacker: string, defender: string): number => {
    return chart.find(c => c.attacker === attacker && c.defender === defender)?.multiplier ?? 1.0
  }

  return (
    <div>
      <p className="text-sm text-zinc-500 mb-6">
        Attacker type (row) vs Defender type (column). Values: <span className="text-green-400">1.5×</span> (strong),
        <span className="text-zinc-400"> 1.0×</span> (neutral),
        <span className="text-red-400"> 0.5×</span> (weak).
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-zinc-500 text-xs font-medium text-left">ATK \ DEF</th>
              {TYPES.map(t => (
                <th key={t} className="p-2 text-center text-xs font-medium text-zinc-400">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPES.map(attacker => (
              <tr key={attacker}>
                <td className="p-2 font-medium text-zinc-300 text-xs whitespace-nowrap">{attacker}</td>
                {TYPES.map(defender => {
                  const mult = getMultiplier(attacker, defender)
                  return (
                    <td
                      key={defender}
                      className={`p-2 text-center text-sm font-mono border border-zinc-800 ${
                        mult > 1.0
                          ? 'bg-green-900/30 text-green-400'
                          : mult < 1.0
                            ? 'bg-red-900/30 text-red-400'
                            : 'bg-zinc-800/30 text-zinc-400'
                      }`}
                    >
                      {mult}×
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
