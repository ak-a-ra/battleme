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
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.UI, pointerEvents: 'none' }}>
      {/* Turn timer — static 30s for now (timer data not in bridge yet) */}
      <TurnTimer totalSecs={30} remainingSecs={15} />

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

      {/* VS label */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 48, fontWeight: 900, color: '#fff',
        textShadow: '3px 3px 0 #000',
        fontFamily: 'monospace',
      }}>
        VS
      </div>

      {/* Floating damage numbers */}
      <FloatingNumbers floaters={floaters} onRemove={onRemoveFloater} />
    </div>
  )
}
