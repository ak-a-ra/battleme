import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Hunter } from '../../lib/invoke'
import SpritePlaceholder from '../../lib/sprite'

export default function WikiHunters() {
  const [hunters, setHunters] = useState<Hunter[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.getHunters().then(setHunters).catch(() => {})
  }, [])

  return (
    <div>
      <div className="text-sm text-zinc-500 mb-4">{hunters.length} hunter(s)</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {hunters.map(h => (
          <button
            key={h.id}
            onClick={() => navigate(`/wiki/hunters/${h.id}`)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 text-left hover:border-amber-600 hover:bg-zinc-700/50 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <SpritePlaceholder spriteId={h.sprite_id} name={h.name} size={48} />
              <div className="min-w-0">
                <div className="font-medium truncate">{h.name}</div>
                <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">{h.class}</span>
              </div>
            </div>
            <div className="text-xs text-zinc-500">
              HP {h.hp} · MP {h.mp}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
