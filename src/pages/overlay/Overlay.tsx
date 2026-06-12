import { useState, useCallback, useRef } from 'react'
import { useBattleState } from '../../hooks/useBattleState'
import BackgroundLayer from './BackgroundLayer'
import EnvironmentLayer from './EnvironmentLayer'
import SpriteLayer from './SpriteLayer'
import UILayer from './UILayer'
import RunningScene from './RunningScene'
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
/// - New turn_log entries spawn floating damage numbers
export default function Overlay() {
  const battle = useBattleState()
  const [showWinScene, setShowWinScene] = useState(false)
  const [prevWinner, setPrevWinner] = useState<string | null>(null)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const prevLogLen = useRef(0)

  // Detect new turn_log entries → spawn floaters
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
    }
  }

  // Detect winner change → trigger running scene
  if (battle?.winner && battle.winner !== prevWinner) {
    setPrevWinner(battle.winner)
    setShowWinScene(true)
  }

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
      }}>
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
      <BackgroundLayer />
      <SpriteLayer battle={battle} />
      <EnvironmentLayer />
      <UILayer battle={battle} floaters={floaters} onRemoveFloater={handleRemoveFloater} />
      {showWinScene && <RunningScene onComplete={handleWinSceneComplete} />}
    </div>
  )
}
