import { useState, useCallback, useRef, useEffect } from 'react'
import { useBattleState } from '../../hooks/useBattleState'
import BackgroundLayer from './BackgroundLayer'
import EnvironmentLayer from './EnvironmentLayer'
import SpriteLayer from './SpriteLayer'
import UILayer from './UILayer'
import RunningScene from './RunningScene'
import { useSound } from './useSound'
import type { SoundType } from './useSound'
import type { Floater } from './FloatingNumbers'
import { BATTLE_FLOOR_Y } from './layers'
import './overlay.css'

/// Main overlay component — OBS browser source target.
///
/// Architecture:
/// - 1920x1080 fixed size
/// - 4 stacked layers (background, sprites, environment, UI)
/// - All battle state from HTTP polling (no Tauri IPC)
/// - Winner triggers RunningScene animation
/// - New turn_log entries spawn floating damage numbers + sound effects
export default function Overlay() {
  const battle = useBattleState()
  const { play } = useSound()
  const [showWinScene, setShowWinScene] = useState(false)
  const [prevWinner, setPrevWinner] = useState<string | null>(null)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const prevLogLen = useRef(0)

  // Detect new turn_log entries → spawn floaters + play sounds
  if (battle && battle.turn_log.length > prevLogLen.current) {
    const newEntries = battle.turn_log.slice(prevLogLen.current)
    prevLogLen.current = battle.turn_log.length

    for (const entry of newEntries) {
      // Position floater above the target team's area
      const isAttackerStreamer = entry.attacker_side === 'streamer'
      const x = isAttackerStreamer ? 1600 : 300
      const y = BATTLE_FLOOR_Y - 120 - Math.random() * 30
      const color = entry.is_crit ? '#fbbf24' : '#ffffff'

      const floater: Floater = {
        id: crypto.randomUUID(),
        text: entry.float_text,
        x, y, isCrit: entry.is_crit, color,
      }
      setFloaters(prev => [...prev, floater])

      // Determine sound for this action
      let sound: SoundType = 'attack'
      if (entry.is_crit) {
        sound = 'crit'
      } else if (entry.damage_dealt > 0) {
        sound = 'damage'
      }
      // Play with slight stagger so sounds don't overlap harshly
      setTimeout(() => play(sound), floaters.length * 80)
    }
  }

  // Detect winner change → trigger running scene + victory sound
  if (battle?.winner && battle.winner !== prevWinner) {
    setPrevWinner(battle.winner)
    setShowWinScene(true)
    play('victory')
    // Also play KO for the final blow — already in turn_log, handled above
  }

  // Play KO sound when a target_ko entry appears (already handled above
  // via damage_dealt>0, but for clear KO detection, play a distinct sound)
  useEffect(() => {
    if (!battle) return
    const lastEntry = battle.turn_log[battle.turn_log.length - 1]
    if (lastEntry?.target_ko) {
      play('ko')
    }
  }, [battle?.turn_log.length])

  const handleWinSceneComplete = useCallback(() => {
    setShowWinScene(false)
  }, [])

  const handleRemoveFloater = useCallback((id: string) => {
    setFloaters(prev => prev.filter(f => f.id !== id))
  }, [])

  if (!battle) {
    return (
      <div style={{
        width: 1920, height: 1080,
        background: '#000',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        fontFamily: 'monospace',
      }}>
        Waiting for battle...
      </div>
    )
  }

  // Show draft status while chat is picking
  if (battle.phase === 'draft') {
    return (
      <div style={{
        width: 1920, height: 1080,
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        fontFamily: 'monospace',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {!battle.twitch_connected && <DisconnectBanner />}
        <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fbbf24' }}>Draft Phase</div>
        <div>Chat is drafting their monsters...</div>
        <div style={{ fontSize: 14, color: '#888' }}>Check the Dashboard to follow picks</div>
      </div>
    )
  }

  // Show idle phase (pre-draft) with background
  if (battle.phase === 'idle' || (battle.streamer_team.length === 0 && battle.chat_team.length === 0)) {
    return (
      <div style={{
        width: 1920, height: 1080,
        position: 'relative',
        overflow: 'hidden',
        background: '#000',
      }}>
        <BackgroundLayer />
        {!battle.twitch_connected && <DisconnectBanner />}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12,
          color: '#fff', fontFamily: 'monospace',
          zIndex: 10,
        }}>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fbbf24' }}>Waiting for battle...</div>
          <div style={{ fontSize: 14, color: '#888' }}>Set your lineup and start the draft</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: 1920,
      height: 1080,
      position: 'relative',
      overflow: 'hidden',
      background: '#000',
    }}>
      {!battle.twitch_connected && <DisconnectBanner />}
      <BackgroundLayer />
      <SpriteLayer battle={battle} />
      <EnvironmentLayer />
      <UILayer battle={battle} floaters={floaters} onRemoveFloater={handleRemoveFloater} />
      {showWinScene && <RunningScene onComplete={handleWinSceneComplete} />}
    </div>
  )
}

/// Pulsing red bar shown when Twitch EventSub is disconnected.
function DisconnectBanner() {
  return (
    <div className="pulse-warning" style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: 32,
      background: '#dc2626',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      zIndex: 100,
      letterSpacing: 1,
    }}>
      ⚡ TWITCH DISCONNECTED — Chat polls unavailable
    </div>
  )
}
