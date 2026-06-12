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
