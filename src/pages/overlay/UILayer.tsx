import { useState, useEffect } from 'react'
import TurnTimer from './TurnTimer'
import MonsterHUD from './MonsterHUD'
import FloatingNumbers from './FloatingNumbers'
import type { Floater } from './FloatingNumbers'
import { Z } from './layers'
import type { OverlayBattleState } from '../../hooks/useBattleState'

interface Props {
  battle: OverlayBattleState
  floaters: Floater[]
  onRemoveFloater: (id: string) => void
}

/// UI Layer — HP/MP bars, status icons, VS label, turn timer, floating numbers.
export default function UILayer({ battle, floaters, onRemoveFloater }: Props) {
  // Live countdown using real elapsed time from poll_started_at_ms
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (battle.poll_duration_secs > 0) {
      const id = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(id)
    }
  }, [battle.poll_duration_secs])

  const elapsedSecs = battle.poll_started_at_ms > 0
    ? (now - battle.poll_started_at_ms) / 1000
    : 0
  const remainingSecs = Math.max(0, battle.poll_duration_secs - elapsedSecs)
  const totalSecs = battle.poll_duration_secs

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.UI, pointerEvents: 'none' }}>
      {/* Turn timer — live from battle state timestamps */}
      {totalSecs > 0 && <TurnTimer totalSecs={totalSecs} remainingSecs={Math.ceil(remainingSecs)} />}

      {/* VS label in center */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fbbf24',
        textShadow: '2px 2px 0 #000',
        fontFamily: 'monospace',
      }}>
        VS
      </div>

      {/* Turn number */}
      <div style={{
        position: 'absolute',
        top: 130,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 16,
        color: '#a1a1aa',
        fontFamily: 'monospace',
      }}>
        Turn {battle.turn_number}
      </div>

      {/* Streamer team HUDs — bottom left */}
      <div style={{ position: 'absolute', left: 20, bottom: 140, display: 'flex', gap: 8 }}>
        {battle.streamer_team.map((mon) => (
          <MonsterHUD
            key={mon.id}
            name={mon.name}
            hp={mon.hp}
            max_hp={mon.max_hp}
            mp={mon.mp}
            max_mp={mon.max_mp}
            monster_type={mon.monster_type}
            active_status={mon.active_status}
            isActive={false}
          />
        ))}
      </div>

      {/* Chat team HUDs — bottom right */}
      <div style={{ position: 'absolute', right: 20, bottom: 140, display: 'flex', gap: 8, flexDirection: 'row-reverse' }}>
        {battle.chat_team.map((mon) => (
          <MonsterHUD
            key={mon.id}
            name={mon.name}
            hp={mon.hp}
            max_hp={mon.max_hp}
            mp={mon.mp}
            max_mp={mon.max_mp}
            monster_type={mon.monster_type}
            active_status={mon.active_status}
            isActive={false}
          />
        ))}
      </div>

      {/* Floating damage numbers */}
      <FloatingNumbers floaters={floaters} onRemove={onRemoveFloater} />
    </div>
  )
}
