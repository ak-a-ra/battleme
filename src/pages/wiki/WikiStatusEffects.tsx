import { useEffect, useState } from 'react'
import { api, type StatusEffect } from '../../lib/invoke'

export default function WikiStatusEffects() {
  const [effects, setEffects] = useState<StatusEffect[]>([])

  useEffect(() => {
    api.getStatusEffects().then(setEffects).catch(() => {})
  }, [])

  return (
    <div>
      <div className="text-sm text-zinc-500 mb-4">{effects.length} status effects</div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-500 text-xs">
              <th className="py-2 pr-4">Icon</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Effect</th>
              <th className="py-2 pr-4">Duration</th>
            </tr>
          </thead>
          <tbody>
            {effects.map(e => (
              <tr key={e.id} className="border-b border-zinc-800">
                <td className="py-2 pr-4 text-lg">{e.icon}</td>
                <td className="py-2 pr-4">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: e.visual_color + '33',
                      color: e.visual_color,
                      border: `1px solid ${e.visual_color}`,
                    }}
                  >
                    {e.name}
                  </span>
                </td>
                <td className="py-2 pr-4 text-zinc-300">{e.effect_per_turn}</td>
                <td className="py-2 pr-4 text-zinc-400">{e.duration} turn(s)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
