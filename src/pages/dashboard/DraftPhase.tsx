import { useState, useEffect } from 'react'
import { api, type Monster } from '../../lib/invoke'
import { useChatDraft, type DraftStatus } from '../../hooks/useChatDraft'

/// Draft phase — runs 3 sequential polls for chat team selection.
export default function DraftPhase() {
  const [allMonsters, setAllMonsters] = useState<Monster[]>([])
  const [streamerMonsterIds, setStreamerMonsterIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [battleReady, setBattleReady] = useState(false)

  const { status, start, reset } = useChatDraft({ allMonsters, streamerMonsterIds })

  // Load monsters and streamer lineup on mount
  useEffect(() => {
    Promise.all([
      api.getMonsters(),
      api.getStreamerLineup(),
    ]).then(([monsters, lineup]) => {
      setAllMonsters(monsters)
      if (lineup) {
        setStreamerMonsterIds(lineup.monsters.map(m => m.id))
      } else {
        setError('Save a streamer lineup first!')
      }
    }).catch(e => setError(String(e)))
    .finally(() => setLoading(false))
  }, [])

  // Watch for draft completion
  useEffect(() => {
    if (status.phase === 'complete') {
      const chatIds = status.chatTeam.map(m => m.id)
      api.setBattlePhase('battle').catch(() => {})
      api.startBattle(chatIds)
        .then(() => setBattleReady(true))
        .catch(e => setError(String(e)))
    }
  }, [status])

  const handleStart = () => {
    setError('')
    api.setBattlePhase('draft').catch(() => {})
    start()
  }

  if (loading) return <div className="text-zinc-400">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chat Draft</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Run 3 sequential Twitch polls so chat can draft their team.
      </p>

      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 text-sm">{error}</div>}
      {battleReady && <div className="bg-green-900/50 text-green-300 p-3 rounded mb-4 text-sm">Battle ready! Switch to the Dashboard battle controls.</div>}

      {/* Status display */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded p-6 mb-6">
        <DraftStatusDisplay status={status} />

        {status.phase === 'idle' && (
          <button
            onClick={handleStart}
            disabled={streamerMonsterIds.length === 0}
            className="mt-4 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 px-6 py-2 rounded font-medium text-sm"
          >
            Start Chat Draft
          </button>
        )}

        {(status.phase === 'complete' || status.phase === 'error') && (
          <button
            onClick={reset}
            className="mt-4 bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm"
          >
            Reset Draft
          </button>
        )}
      </div>

      {/* Results summary */}
      {status.phase === 'complete' && (
        <div>
          <h2 className="text-lg font-bold mb-2">Chat Team</h2>
          <div className="grid grid-cols-3 gap-3">
            {status.chatTeam.map(mon => (
              <div key={mon.id} className="bg-zinc-800 border border-zinc-700 rounded p-3 text-center">
                <div className="w-12 h-12 rounded bg-purple-700/30 flex items-center justify-center text-2xl mx-auto mb-2">
                  {mon.name[0]}
                </div>
                <div className="font-medium text-sm">{mon.name}</div>
                <div className="text-xs text-zinc-500">{mon.monster_type}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DraftStatusDisplay({ status }: { status: DraftStatus }) {
  const phase = status.phase

  if (phase === 'idle') {
    return <p className="text-zinc-400">Ready to start draft.</p>
  }

  if (phase === 'starting') {
    return (
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <span className="text-amber-400">Starting draft...</span>
      </div>
    )
  }

  if (phase === 'poll_1' || phase === 'poll_2' || phase === 'poll_3') {
    const slotNum = phase === 'poll_1' ? 1 : phase === 'poll_2' ? 2 : 3
    const poolSize = status.pool.length
    return (
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="w-4 h-4 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
          <span className="text-green-400 font-medium">Poll active — Slot {slotNum}</span>
        </div>
        <p className="text-sm text-zinc-400 mb-2">Available monsters: {poolSize}</p>
        <div className="flex gap-2 flex-wrap">
          {status.pool.slice(0, 4).map(m => (
            <span key={m.id} className="bg-zinc-700 px-2 py-1 rounded text-xs">
              {m.name}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div>
        <p className="text-green-400 font-medium mb-2">✓ Draft complete! Team selected:</p>
        <div className="flex gap-2">
          {status.picks.map(pick => (
            <span key={pick.slot} className="bg-zinc-700 px-2 py-1 rounded text-xs">
              Slot {pick.slot}: {pick.monster.name}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return <p className="text-red-400">✗ {status.message}</p>
  }

  return null
}
