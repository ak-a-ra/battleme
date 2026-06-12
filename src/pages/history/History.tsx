import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type BattleLog, type Monster } from '../../lib/invoke'

/// History list page — shows all battle logs with winner, date, monsters.
export default function History() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<BattleLog[]>([])
  const [monsters, setMonsters] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getBattleLogs(), api.getMonsters()])
      .then(([battleLogs, monsterList]) => {
        setLogs(battleLogs)
        setMonsters(new Map(monsterList.map((m: Monster) => [m.id, m.name])))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const monName = (idsJson: string): string => {
    try {
      const ids: number[] = JSON.parse(idsJson)
      return ids.map(id => monsters.get(id) || `#${id}`).join(', ')
    } catch {
      return idsJson
    }
  }

  const formatDate = (dateStr: string) => {
    // SQLite datetime('now') format: YYYY-MM-DD HH:MM:SS
    try {
      const d = new Date(dateStr.replace(' ', 'T') + 'Z')
      return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return <div className="text-zinc-400 p-8">Loading battle history...</div>
  }

  if (logs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold mb-4">No Battles Yet</h2>
        <p className="text-zinc-400">Complete a battle to see it here.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Battle History</h1>
      <div className="space-y-3">
        {logs.map(log => (
          <div
            key={log.id}
            onClick={() => navigate(`/history/${log.id}`)}
            className="bg-zinc-800/50 border border-zinc-700 rounded p-4 cursor-pointer hover:border-zinc-500 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-500">{formatDate(log.date)}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  log.winner_side === 'streamer'
                    ? 'bg-green-900/50 text-green-300'
                    : 'bg-red-900/50 text-red-300'
                }`}>
                  {log.winner_side === 'streamer' ? 'Streamer' : 'Chat'}
                </span>
              </div>
              <span className="text-xs text-zinc-600">
                {log.turns ? (JSON.parse(log.turns) as any[]).length : 0} turns
                {log.duration_secs > 0 && ` · ${Math.floor(log.duration_secs / 60)}m ${log.duration_secs % 60}s`}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-amber-400 text-xs font-medium mr-2">Streamer</span>
                <span className="text-zinc-300">{monName(log.streamer_team)}</span>
              </div>
              <span className="text-zinc-600">vs</span>
              <div>
                <span className="text-purple-400 text-xs font-medium mr-2">Chat</span>
                <span className="text-zinc-300">{monName(log.chat_team)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
