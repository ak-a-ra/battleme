import { useState, useCallback } from 'react'
import { useBattleState } from '../../hooks/useBattleState'
import BackgroundLayer from './BackgroundLayer'
import EnvironmentLayer from './EnvironmentLayer'
import SpriteLayer from './SpriteLayer'
import RunningScene from './RunningScene'
import './overlay.css'

/// Main overlay component — OBS browser source target.
///
/// Architecture:
/// - 1920x1080 fixed size
/// - 4 stacked layers (background, sprites, environment, UI)
/// - All battle state from HTTP polling (no Tauri IPC)
/// - Winner triggers RunningScene animation
export default function Overlay() {
  const battle = useBattleState()
  const [showWinScene, setShowWinScene] = useState(false)
  const [prevWinner, setPrevWinner] = useState<string | null>(null)

  // Detect winner change → trigger running scene
  if (battle?.winner && battle.winner !== prevWinner) {
    setPrevWinner(battle.winner)
    setShowWinScene(true)
  }

  const handleWinSceneComplete = useCallback(() => {
    setShowWinScene(false)
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
      {showWinScene && <RunningScene onComplete={handleWinSceneComplete} />}
    </div>
  )
}
