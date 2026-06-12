import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type Monster, type Ability } from '../../lib/invoke'
import SpritePlaceholder from '../../lib/sprite'
import TypeBadge from '../overlay/TypeBadge'
import StatBars from './StatBars'

export default function WikiMonsterDetail() {
  const { id } = useParams<{ id: string }>()
  const [monster, setMonster] = useState<Monster | null>(null)
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mid = parseInt(id || '0', 10)
    if (!mid) { setLoading(false); return }

    api.getMonsters().then(all => {
      const m = all.find(x => x.id === mid)
      setMonster(m || null)
    }).catch(() => setMonster(null))

    api.getAbilitiesForMonster(mid)
      .then(setAbilities)
      .catch(() => setAbilities([]))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-zinc-400 py-8 text-center">Loading...</div>
  }

  if (!monster) {
    return (
      <div className="text-center py-12">
        <div className="text-zinc-500 mb-4">Monster not found.</div>
        <Link to="/wiki/monsters" className="text-amber-400 hover:text-amber-300 text-sm">← Back to Monsters</Link>
      </div>
    )
  }

  const activeAbilities = abilities.filter(a => !a.is_passive)
  const passiveAbilities = abilities.filter(a => a.is_passive)

  return (
    <div>
      <Link to="/wiki/monsters" className="text-amber-400 hover:text-amber-300 text-sm mb-4 inline-block">
        ← Back to Monsters
      </Link>

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <SpritePlaceholder spriteId={monster.sprite_id} name={monster.name} size={128} />
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold">{monster.name}</h2>
            <TypeBadge type={monster.monster_type} />
            {monster.generated_by_llm && (
              <span className="text-[10px] bg-purple-800 text-purple-200 px-2 py-0.5 rounded">LLM Generated</span>
            )}
          </div>
          <p className="text-zinc-400 italic max-w-lg">{monster.lore}</p>
          <div className="text-xs text-zinc-600 mt-2">HP {monster.hp} · MP {monster.mp}</div>
        </div>
      </div>

      {/* Stat bars */}
      <div className="mb-8 max-w-md">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Stats</h3>
        <StatBars stats={{
          str_stat: monster.str_stat,
          agi: monster.agi,
          dex: monster.dex,
          int_stat: monster.int_stat,
          luck: monster.luck,
        }} />
      </div>

      {/* Active abilities */}
      {activeAbilities.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Abilities</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-zinc-500 text-xs">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">MP</th>
                  <th className="py-2 pr-4">Power</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Effect</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeAbilities.map(a => (
                  <tr key={a.id} className="border-b border-zinc-800">
                    <td className="py-2 pr-4 font-medium">{a.name}</td>
                    <td className="py-2 pr-4 text-zinc-400">{a.mp_cost}</td>
                    <td className="py-2 pr-4 text-zinc-400">{a.power}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        a.ability_type === 'physical' ? 'bg-orange-900/50 text-orange-300' : 'bg-blue-900/50 text-blue-300'
                      }`}>
                        {a.ability_type}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">{a.effect || '—'}</td>
                    <td className="py-2 pr-4 text-zinc-400">{a.status_inflict_id ? 'Yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Passive abilities */}
      {passiveAbilities.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Passive Skills</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-zinc-500 text-xs">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Effect</th>
                </tr>
              </thead>
              <tbody>
                {passiveAbilities.map(a => (
                  <tr key={a.id} className="border-b border-zinc-800">
                    <td className="py-2 pr-4 font-medium">{a.name}</td>
                    <td className="py-2 pr-4 text-zinc-400">{a.effect || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
