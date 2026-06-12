import { useState } from 'react'
import { useBattleControls } from '../../hooks/useBattleControls'
import MoveSelector from './MoveSelector'
import RoundSettings from './RoundSettings'
import { api } from '../../lib/invoke'
import { BRIDGE_OVERLAY_URL } from '../../lib/config'

/// Battle control page — streamer picks moves, sees battle state, controls turn flow.
export default function BattlePage() {
  const {
    phase, battle, activeStreamerIdx, activeChatIdx,
    streamerAbilities, streamerMove, setStreamerMove,
    turnDisplay, settings, setSettings,
    startTurn, continueAfterResult, surrender, error,
  } = useBattleControls()

  const [saved, setSaved] = useState(false)
  const OBS_URL = import.meta.env.PROD ? BRIDGE_OVERLAY_URL : 'http://localhost:3000/overlay'

  const handleSelectMove = (abilityId: number) => {
    if (abilityId === 0) {
      setStreamerMove({ name: 'Basic Attack', base_power: 10, ability_type: 'physical', status_inflict_name: null, status_duration: 0 })
    } else {
      api.getAbilityInput(abilityId).then(setStreamerMove).catch(() => {})
    }
  }

  const handleSaveResult = async () => {
    try {
      await api.saveBattleResult()
      setSaved(true)
    } catch {}
  }

  const handleCopyOBS = () => {
    navigator.clipboard.writeText(OBS_URL)
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading battle state...</div>
      </div>
    )
  }

  if (phase === 'idle') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold mb-4">No Active Battle</h2>
        <p className="text-zinc-400 mb-6">Complete the draft first, then come here to control the battle.</p>
        <p className="text-zinc-600 text-sm">Go to Draft → Start Chat Draft → Battle will initialize automatically.</p>
      </div>
    )
  }

  const activeStreamerMon = activeStreamerIdx >= 0 && battle ? battle.streamer_team[activeStreamerIdx] : null
  const activeChatMon = activeChatIdx >= 0 && battle ? battle.chat_team[activeChatIdx] : null
  const phaseLabel: Record<string, string> = {
    streamer_pick: 'Pick your move',
    poll_active: 'Chat is voting...',
    resolving: 'Resolving turn...',
    turn_result: 'Turn result',
    battle_over: 'Battle Over',
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Error banner */}
      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 text-sm">{error}</div>}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Battle</h1>
          {battle && (
            <span className="text-zinc-500 text-sm">
              Turn {battle.turn_number}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            phase === 'poll_active' ? 'bg-green-900/50 text-green-300' :
            phase === 'resolving' ? 'bg-yellow-900/50 text-yellow-300' :
            phase === 'battle_over' ? 'bg-red-900/50 text-red-300' :
            'bg-zinc-800 text-zinc-300'
          }`}>
            {phaseLabel[phase] || phase}
          </span>
        </div>
        <button
          onClick={handleCopyOBS}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded"
        >
          📋 Copy OBS URL
        </button>
      </div>

      {/* Round settings — always visible */}
      <div className="mb-6">
        <RoundSettings settings={settings} onChange={setSettings} />
      </div>

      {/* Teams display */}
      {battle && (
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Streamer team */}
          <div>
            <h3 className="text-sm font-medium text-amber-400 mb-2">Your Team</h3>
            {battle.streamer_team.map((mon, i) => (
              <div key={mon.id} className={`border rounded p-3 mb-2 text-sm ${
                i === activeStreamerIdx ? 'border-amber-600 bg-amber-900/20' : 'border-zinc-700 bg-zinc-800/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{mon.name}</span>
                  <span className="text-xs text-zinc-500">{mon.monster_type}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-500 w-6">HP</span>
                  <div className="flex-1 h-2 bg-zinc-700 rounded overflow-hidden">
                    <div className="h-full bg-green-500 rounded transition-all" style={{ width: `${(mon.hp / mon.max_hp) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-16 text-right">{mon.hp}/{mon.max_hp}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-500 w-6">MP</span>
                  <div className="flex-1 h-2 bg-zinc-700 rounded overflow-hidden">
                    <div className="h-full bg-blue-500 rounded transition-all" style={{ width: `${(mon.mp / mon.max_mp) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-16 text-right">{mon.mp}/{mon.max_mp}</span>
                </div>
                {mon.active_status && (
                  <div className="text-xs text-red-400 mt-1">{mon.active_status.name} ({mon.active_status.turns_left})</div>
                )}
                {mon.is_ko && <div className="text-xs text-red-500 mt-1 font-bold">💀 KO</div>}
              </div>
            ))}
          </div>

          {/* Chat team */}
          <div>
            <h3 className="text-sm font-medium text-purple-400 mb-2">Chat Team</h3>
            {battle.chat_team.map((mon, i) => (
              <div key={mon.id} className={`border rounded p-3 mb-2 text-sm ${
                i === activeChatIdx ? 'border-purple-600 bg-purple-900/20' : 'border-zinc-700 bg-zinc-800/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{mon.name}</span>
                  <span className="text-xs text-zinc-500">{mon.monster_type}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-500 w-6">HP</span>
                  <div className="flex-1 h-2 bg-zinc-700 rounded overflow-hidden">
                    <div className="h-full bg-green-500 rounded transition-all" style={{ width: `${(mon.hp / mon.max_hp) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-16 text-right">{mon.hp}/{mon.max_hp}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-500 w-6">MP</span>
                  <div className="flex-1 h-2 bg-zinc-700 rounded overflow-hidden">
                    <div className="h-full bg-blue-500 rounded transition-all" style={{ width: `${(mon.mp / mon.max_mp) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-16 text-right">{mon.mp}/{mon.max_mp}</span>
                </div>
                {mon.active_status && (
                  <div className="text-xs text-red-400 mt-1">{mon.active_status.name} ({mon.active_status.turns_left})</div>
                )}
                {mon.is_ko && <div className="text-xs text-red-500 mt-1 font-bold">💀 KO</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Move selector (streamer pick phase) */}
      {phase === 'streamer_pick' && activeStreamerMon && (
        <div className="mb-6">
          <MoveSelector
            abilities={streamerAbilities}
            monsterName={activeStreamerMon.name}
            mp={activeStreamerMon.mp}
            disabled={false}
            isStunned={activeStreamerMon.active_status?.name === 'Stun'}
            onSelect={handleSelectMove}
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={startTurn}
              className="bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded font-medium text-sm"
            >
              {streamerMove ? `Start Turn (${streamerMove.name})` : 'Start Turn (Basic Attack)'}
            </button>
            <button
              onClick={surrender}
              className="bg-red-800 hover:bg-red-700 px-4 py-2 rounded text-sm"
            >
              Surrender
            </button>
          </div>
        </div>
      )}

      {/* Poll active state */}
      {phase === 'poll_active' && (
        <div className="mb-6 bg-zinc-800/50 border border-zinc-700 rounded p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="w-4 h-4 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
            <span className="text-green-400 font-medium">Chat is voting for their move...</span>
          </div>
          {activeChatMon && (
            <p className="text-sm text-zinc-500">{activeChatMon.name}'s abilities are in the poll</p>
          )}
          <p className="text-xs text-zinc-600 mt-2">Poll duration: {settings.pollDuration}s</p>
        </div>
      )}

      {/* Resolving state */}
      {phase === 'resolving' && (
        <div className="mb-6 bg-zinc-800/50 border border-zinc-700 rounded p-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
            <span className="text-yellow-400 font-medium">Resolving turn...</span>
          </div>
        </div>
      )}

      {/* Turn result display */}
      {phase === 'turn_result' && turnDisplay && (
        <div className="mb-6">
          <div className="bg-zinc-800/50 border border-amber-700/50 rounded p-4 mb-4">
            <h3 className="text-sm font-medium text-amber-400 mb-2">Turn {turnDisplay.number} — Result</h3>
            <div className="text-sm text-zinc-300 mb-2">
              <span className="text-amber-400">You</span> used <strong>{turnDisplay.streamerAbility}</strong>
              <span className="mx-2 text-zinc-600">vs</span>
              <span className="text-purple-400">Chat</span> used <strong>{turnDisplay.chatAbility}</strong>
            </div>
            <div className="space-y-1">
              {turnDisplay.log.map((entry: any, i: number) => (
                <div key={i} className="text-xs text-zinc-400">
                  <span className={entry.attacker_side === 'streamer' ? 'text-amber-400' : 'text-purple-400'}>
                    {entry.attacker_side}
                  </span>
                  {' '}{entry.float_text}
                  {entry.target_ko && <span className="text-red-400 font-bold ml-1">💀 KO!</span>}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={continueAfterResult}
            className="bg-amber-600 hover:bg-amber-500 px-6 py-2 rounded font-medium text-sm"
          >
            Continue
          </button>
        </div>
      )}

      {/* Battle over */}
      {phase === 'battle_over' && battle?.winner && (
        <div className="mb-6 bg-zinc-800/50 border-2 border-amber-600 rounded p-6 text-center">
          <h2 className="text-2xl font-bold mb-2">
            {battle.winner === 'streamer' ? '🏆 You Win!' : '💀 Chat Wins!'}
          </h2>
          <p className="text-zinc-400 text-sm mb-4">
            Battle ended in {battle.turn_number} turns.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleSaveResult}
              disabled={saved}
              className="bg-green-700 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 px-4 py-2 rounded text-sm"
            >
              {saved ? '✓ Saved' : 'Save Result'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
