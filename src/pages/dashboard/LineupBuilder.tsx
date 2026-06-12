import { useState, useEffect } from 'react'
import { api, type Monster, type Hunter } from '../../lib/invoke'

/// Lineup builder — streamer picks 3 monsters + hunter before battle.
export default function LineupBuilder() {
  const [pool, setPool] = useState<Monster[]>([])
  const [hunters, setHunters] = useState<Hunter[]>([])
  const [selected, setSelected] = useState<Monster[]>([])
  const [hunterId, setHunterId] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load monsters, hunters, and existing lineup on mount
  useEffect(() => {
    Promise.all([
      api.getMonsters(),
      api.getHunters(),
      api.getStreamerLineup(),
    ]).then(([monsters, hunters, lineup]) => {
      setPool(monsters)
      setHunters(hunters)
      if (lineup) {
        setSelected(lineup.monsters)
        setHunterId(lineup.hunter.id)
        setSaved(true)
      }
      if (hunters.length > 0 && !hunterId) {
        setHunterId(hunters[0].id)
      }
    }).catch(e => setError(String(e)))
    .finally(() => setLoading(false))
  }, [])

  const toggleMonster = (mon: Monster) => {
    if (selected.find(m => m.id === mon.id)) {
      setSelected(selected.filter(m => m.id !== mon.id))
    } else if (selected.length < 3) {
      setSelected([...selected, mon])
    }
    setSaved(false)
  }

  const handleSave = async () => {
    if (selected.length !== 3) {
      setError('Select exactly 3 monsters')
      return
    }
    if (!hunterId) {
      setError('Select a hunter')
      return
    }
    try {
      await api.saveStreamerLineup(hunterId, selected.map(m => m.id))
      setSaved(true)
      setError('')
    } catch (e: any) {
      setError(String(e))
    }
  }

  if (loading) return <div className="text-zinc-400">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Lineup Builder</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Pick 3 monsters and a hunter for your pre-stream lineup.
      </p>

      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 text-sm">{error}</div>}
      {saved && <div className="bg-green-900/50 text-green-300 p-3 rounded mb-4 text-sm">Lineup saved!</div>}

      {/* Hunter selector */}
      <div className="mb-6">
        <label className="text-sm text-zinc-400 block mb-1">Hunter</label>
        <select
          value={hunterId ?? ''}
          onChange={e => setHunterId(Number(e.target.value))}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm w-48"
        >
          {hunters.map(h => (
            <option key={h.id} value={h.id}>{h.name} ({h.class})</option>
          ))}
        </select>
      </div>

      {/* Selected slots */}
      <div className="mb-6">
        <label className="text-sm text-zinc-400 block mb-2">Your Team ({selected.length}/3)</label>
        <div className="flex gap-3">
          {[0, 1, 2].map(i => {
            const mon = selected[i]
            return (
              <div key={i} className="w-40 h-48 bg-zinc-800 border border-zinc-700 rounded flex flex-col items-center justify-center p-2">
                {mon ? (
                  <>
                    <div className="w-14 h-14 rounded bg-amber-700/30 flex items-center justify-center text-2xl mb-2">
                      {mon.name[0]}
                    </div>
                    <span className="text-sm font-medium text-center leading-tight">{mon.name}</span>
                    <span className="text-xs text-zinc-500 mt-1">{mon.monster_type}</span>
                  </>
                ) : (
                  <span className="text-zinc-600 text-xs">Empty slot</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Monster pool */}
      <label className="text-sm text-zinc-400 block mb-2">Monster Pool</label>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
        {pool.map(mon => {
          const isSelected = !!selected.find(m => m.id === mon.id)
          const isFull = selected.length >= 3 && !isSelected
          return (
            <button
              key={mon.id}
              onClick={() => toggleMonster(mon)}
              disabled={isFull}
              className={`border rounded p-2 text-center text-xs transition-all ${
                isSelected
                  ? 'border-amber-500 bg-amber-900/30'
                  : isFull
                    ? 'border-zinc-800 bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
              }`}
            >
              <div className="w-8 h-8 rounded bg-amber-700/20 flex items-center justify-center text-sm mx-auto mb-1">
                {mon.name[0]}
              </div>
              <div className="font-medium truncate">{mon.name}</div>
              <div className="text-zinc-500">{mon.monster_type}</div>
            </button>
          )
        })}
      </div>

      {/* Save button */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          disabled={selected.length !== 3}
          className="bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 px-6 py-2 rounded font-medium text-sm"
        >
          Save Lineup
        </button>
      </div>
    </div>
  )
}
