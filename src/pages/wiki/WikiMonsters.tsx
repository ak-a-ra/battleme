import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Monster } from '../../lib/invoke'
import SpritePlaceholder from '../../lib/sprite'
import TypeBadge from '../overlay/TypeBadge'

const TYPES = ['Fire', 'Water', 'Earth', 'Wind', 'Dark', 'Light']

export default function WikiMonsters() {
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.getMonsters().then(setMonsters).catch(() => {})
  }, [])

  const filtered = monsters.filter(m => {
    if (typeFilter && m.monster_type !== typeFilter) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      {/* Search + type filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search monsters..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm w-48"
        />
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setTypeFilter(null)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              !typeFilter ? 'bg-amber-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                typeFilter === t ? 'bg-amber-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-zinc-500 text-sm py-8 text-center">No monsters match your filters.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(m => (
            <button
              key={m.id}
              onClick={() => navigate(`/wiki/monsters/${m.id}`)}
              className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 text-left hover:border-amber-600 hover:bg-zinc-700/50 transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                <SpritePlaceholder spriteId={m.sprite_id} name={m.name} size={48} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <TypeBadge type={m.monster_type} />
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                HP {m.hp} · MP {m.mp}
              </div>
              {m.generated_by_llm && (
                <span className="text-[10px] bg-purple-800/50 text-purple-300 px-1.5 py-0.5 rounded mt-1 inline-block">
                  LLM
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
