import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type BattleLog, type Monster } from '../../lib/invoke'

/// Turn log entry from the battle engine (JSON-serialized TurnResult).
interface TurnEntry {
  attacker_side: string
  attacker_name: string
  ability_used: string
  damage_dealt: number
  is_crit: boolean
  status_inflicted: string | null
  target_hp_after: number
  target_ko: boolean
  float_text: string
}

/// History detail page — shows a single battle log with turn timeline.
export default function HistoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [log, setLog] = useState<BattleLog | null>(null)
  const [monsters, setMonsters] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([api.getBattleLog(Number(id)), api.getMonsters()])
      .then(([battleLog, monsterList]) => {
        setLog(battleLog)
        setMonsters(new Map(monsterList.map((m: Monster) => [m.id, m.name])))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const monName = (idsJson: string): string => {
    try {
      const ids: number[] = JSON.parse(idsJson)
      return ids.map(id => monsters.get(id) || `#${id}`).join(', ')
    } catch {
      return idsJson
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr.replace(' ', 'T') + 'Z')
      return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return <div className="text-zinc-400 p-8">Loading battle log...</div>
  }

  if (!log) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Battle Not Found</h2>
        <p className="text-zinc-400 mb-4">This battle log doesn't exist.</p>
        <button onClick={() => navigate('/history')} className="text-amber-400 hover:underline text-sm">
          ← Back to History
        </button>
      </div>
    )
  }

  let turns: TurnEntry[] = []
  try {
    turns = JSON.parse(log.turns)
  } catch {}

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <button onClick={() => navigate('/history')} className="text-amber-400 hover:underline text-sm mb-4">
        ← Back to History
      </button>

      {/* Header card */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Battle Log</h1>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            log.winner_side === 'streamer'
              ? 'bg-green-900/50 text-green-300'
              : 'bg-red-900/50 text-red-300'
          }`}>
            {log.winner_side === 'streamer' ? '🏆 Streamer Win' : '💀 Chat Win'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">Date: </span>
            <span className="text-zinc-300">{formatDate(log.date)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Turns: </span>
            <span className="text-zinc-300">{turns.length}</span>
          </div>
          <div>
            <span className="text-zinc-500">Streamer team: </span>
            <span className="text-amber-400">{monName(log.streamer_team)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Chat team: </span>
            <span className="text-purple-400">{monName(log.chat_team)}</span>
          </div>
          {log.duration_secs > 0 && (
            <div>
              <span className="text-zinc-500">Duration: </span>
              <span className="text-zinc-300">{Math.floor(log.duration_secs / 60)}m {log.duration_secs % 60}s</span>
            </div>
          )}
        </div>
      </div>

      {/* Turn timeline */}
      {turns.length === 0 ? (
        <div className="text-zinc-500 text-sm">No turn data available.</div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold mb-2">Turn Timeline</h2>
          {turns.map((entry, i) => {
            const isStreamer = entry.attacker_side === 'streamer'
            return (
              <div
                key={i}
                className={`border-l-4 rounded p-3 ${
                  isStreamer
                    ? 'border-amber-600 bg-zinc-800/40'
                    : 'border-purple-600 bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                  <span>Turn {i + 1}</span>
                  <span className={isStreamer ? 'text-amber-400' : 'text-purple-400'}>
                    {entry.attacker_side}
                  </span>
                </div>
                <div className="text-sm text-zinc-300">
                  <strong className={isStreamer ? 'text-amber-400' : 'text-purple-400'}>
                    {entry.attacker_name}
                  </strong>
                  {' '}used <strong>{entry.ability_used}</strong>
                  {' → '}
                  <span className={entry.is_crit ? 'text-yellow-400 font-bold' : 'text-zinc-100'}>
                    {entry.damage_dealt} dmg
                  </span>
                  {entry.is_crit && <span className="text-yellow-400 font-bold ml-1">CRIT!</span>}
                  {entry.status_inflicted && (
                    <span className="text-red-400 ml-1">[{entry.status_inflicted}]</span>
                  )}
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  {entry.float_text}
                  {entry.target_ko && <span className="text-red-400 font-bold ml-1">💀 KO!</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
