import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type Hunter } from '../../lib/invoke'
import SpritePlaceholder from '../../lib/sprite'
import StatBars from './StatBars'

export default function WikiHunterDetail() {
  const { id } = useParams<{ id: string }>()
  const [hunter, setHunter] = useState<Hunter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hid = parseInt(id || '0', 10)
    if (!hid) { setLoading(false); return }

    api.getHunters().then(all => {
      const h = all.find(x => x.id === hid)
      setHunter(h || null)
    }).catch(() => setHunter(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-zinc-400 py-8 text-center">Loading...</div>
  }

  if (!hunter) {
    return (
      <div className="text-center py-12">
        <div className="text-zinc-500 mb-4">Hunter not found.</div>
        <Link to="/wiki/hunters" className="text-amber-400 hover:text-amber-300 text-sm">← Back to Hunters</Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/wiki/hunters" className="text-amber-400 hover:text-amber-300 text-sm mb-4 inline-block">
        ← Back to Hunters
      </Link>

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <SpritePlaceholder spriteId={hunter.sprite_id} name={hunter.name} size={128} />
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold">{hunter.name}</h2>
            <span className="text-xs bg-zinc-700 text-zinc-200 px-2 py-0.5 rounded">{hunter.class}</span>
          </div>
          <p className="text-zinc-400 italic max-w-lg">{hunter.lore}</p>
          <div className="text-xs text-zinc-600 mt-2">HP {hunter.hp} · MP {hunter.mp}</div>
        </div>
      </div>

      {/* Stat bars */}
      <div className="max-w-md">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Stats</h3>
        <StatBars stats={{
          str_stat: hunter.str_stat,
          agi: hunter.agi,
          dex: hunter.dex,
          int_stat: hunter.int_stat,
          luck: hunter.luck,
        }} />
      </div>
    </div>
  )
}
