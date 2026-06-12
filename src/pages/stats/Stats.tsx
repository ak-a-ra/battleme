import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api, type BattleLog, type Monster } from '../../lib/invoke'

/// Stats page — win ratio pie chart + top monsters bar chart.
export default function Stats() {
  const [logs, setLogs] = useState<BattleLog[]>([])
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getBattleLogs(), api.getMonsters()])
      .then(([battleLogs, monsterList]) => {
        setLogs(battleLogs)
        setMonsters(monsterList)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-zinc-400 p-8">Loading stats...</div>
  }

  if (logs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold mb-4">No Data Yet</h2>
        <p className="text-zinc-400">Complete battles to see stats here.</p>
      </div>
    )
  }

  // ── Compute stats ──
  const total = logs.length
  const streamerWins = logs.filter(l => l.winner_side === 'streamer').length
  const chatWins = logs.filter(l => l.winner_side === 'chat').length
  const avgTurns = logs.reduce((sum, l) => {
    try { return sum + (JSON.parse(l.turns) as any[]).length }
    catch { return sum }
  }, 0) / total

  // Monster usage count
  const usageCount = new Map<number, number>()
  for (const log of logs) {
    for (const field of ['streamer_team', 'chat_team'] as const) {
      try {
        const ids: number[] = JSON.parse(log[field])
        for (const id of ids) {
          usageCount.set(id, (usageCount.get(id) || 0) + 1)
        }
      } catch {}
    }
  }
  const monMap = new Map(monsters.map(m => [m.id, m.name]))
  const topMonsters = [...usageCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ name: monMap.get(id) || `#${id}`, count }))

  const pieData = [
    { name: 'Streamer', value: streamerWins, color: '#f59e0b' },
    { name: 'Chat', value: chatWins, color: '#8b5cf6' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-800/50 border border-zinc-700 rounded p-4 text-center">
          <div className="text-3xl font-bold text-zinc-100">{total}</div>
          <div className="text-xs text-zinc-500 mt-1">Total Battles</div>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{streamerWins}</div>
          <div className="text-xs text-zinc-500 mt-1">Streamer Wins</div>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded p-4 text-center">
          <div className="text-3xl font-bold text-purple-400">{chatWins}</div>
          <div className="text-xs text-zinc-500 mt-1">Chat Wins</div>
        </div>
      </div>

      <div className="text-sm text-zinc-500 mb-8 text-center">
        {total} battle{total !== 1 ? 's' : ''} played
        {total > 0 && `, avg ${avgTurns.toFixed(1)} turns per battle`}
      </div>

      {/* Win ratio pie chart */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Win Ratio</h2>
        <div className="flex justify-center" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }: Record<string, any>) =>
                `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top monsters bar chart */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded p-6">
        <h2 className="text-lg font-semibold mb-4">Most Picked Monsters</h2>
        {topMonsters.length === 0 ? (
          <div className="text-zinc-500 text-sm">No data yet.</div>
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMonsters}>
                <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
                <YAxis stroke="#a1a1aa" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#27272a', border: '1px solid #52525b', borderRadius: 4 }}
                  labelStyle={{ color: '#e4e4e7' }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
