import { Z, BATTLE_FLOOR_Y } from './layers'
import Sprite from './Sprite'
import type { OverlayBattleState } from '../../hooks/useBattleState'

interface Props {
  battle: OverlayBattleState
}

/// Sprite layer — positions all monsters on the battlefield.
/// Streamer team: left side, left-to-right.
/// Chat team: right side, flipped (facing left).
/// All sit at BATTLE_FLOOR_Y.
export default function SpriteLayer({ battle }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.SPRITES, pointerEvents: 'none' }}>
      {/* Streamer monsters — left side */}
      {battle.streamer_team.map((mon, i) => (
        <Sprite
          key={mon.id}
          spriteId={mon.name.toLowerCase().replace(/\s+/g, '')}
          name={mon.name}
          state={mon.is_ko ? 'ko' : 'idle'}
          isActive={false}
          isKo={mon.is_ko}
          style={{
            position: 'absolute',
            left: 180 + i * 120,
            top: BATTLE_FLOOR_Y - 72,
          }}
        />
      ))}

      {/* Chat monsters — right side, flipped */}
      {battle.chat_team.map((mon, i) => (
        <Sprite
          key={mon.id}
          spriteId={mon.name.toLowerCase().replace(/\s+/g, '')}
          name={mon.name}
          state={mon.is_ko ? 'ko' : 'idle'}
          isActive={false}
          isKo={mon.is_ko}
          flipX
          style={{
            position: 'absolute',
            right: 80 + i * 120,
            top: BATTLE_FLOOR_Y - 72,
          }}
        />
      ))}
    </div>
  )
}
