import { useEffect, useRef, useState } from 'react'
import { Z, BATTLE_FLOOR_Y } from './layers'
import Sprite from './Sprite'
import type { OverlayBattleState } from '../../hooks/useBattleState'
import type { SpriteState } from './Sprite'

interface Props {
  battle: OverlayBattleState
}

/// Sprite layer — positions all monsters on the battlefield.
/// Streamer team: left side, left-to-right.
/// Chat team: right side, flipped (facing left).
/// Detects new turn_log entries and animates:
///   - attacker side → 'attack' (lunge forward)
///   - target side → 'damaged' (flinch)
/// Animations reset to 'idle' after 600ms.
export default function SpriteLayer({ battle }: Props) {
  const [animStates, setAnimStates] = useState<Record<number, SpriteState>>({})
  const prevLogLen = useRef(battle.turn_log.length)
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([])

  // Watch for new turn_log entries → trigger animations
  useEffect(() => {
    const newLen = battle.turn_log.length
    if (newLen <= prevLogLen.current) return
    const newEntries = battle.turn_log.slice(prevLogLen.current)
    prevLogLen.current = newLen

    // Collect all monster names from each side for this new batch
    const attackerNames = new Set<string>()
    for (const entry of newEntries) {
      attackerNames.add(entry.attacker_name)
    }

    // Build a map of name → monster id for both teams
    const nameToId: Record<string, number> = {}
    for (const mon of battle.streamer_team) nameToId[mon.name] = mon.id
    for (const mon of battle.chat_team) nameToId[mon.name] = mon.id

    const newStates: Record<number, SpriteState> = {}

    // Mark attackers
    for (const name of attackerNames) {
      const id = nameToId[name]
      if (id !== undefined) newStates[id] = 'attack'
    }

    // Mark targets (opponents of attackers, or just the team that was hit)
    // Every entry's target is the non-attacker side
    for (const entry of newEntries) {
      const targetSide = entry.attacker_side === 'streamer' ? battle.chat_team : battle.streamer_team
      for (const mon of targetSide) {
        // Only mark non-KO targets
        if (!mon.is_ko && newStates[mon.id] !== 'attack') {
          newStates[mon.id] = 'damaged'
        }
      }
    }

    if (Object.keys(newStates).length === 0) return

    // Apply animation states
    setAnimStates(prev => ({ ...prev, ...newStates }))

    // Schedule reset after 600ms
    const ids = Object.keys(newStates).map(Number)
    for (const id of ids) {
      const t = setTimeout(() => {
        setAnimStates(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }, 600)
      timeouts.current.push(t)
    }

    // Cleanup timeouts on unmount
    return () => {
      for (const t of timeouts.current) clearTimeout(t)
      timeouts.current = []
    }
  }, [battle.turn_log, battle.streamer_team, battle.chat_team])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.SPRITES, pointerEvents: 'none' }}>
      {/* Streamer monsters — left side */}
      {battle.streamer_team.map((mon, i) => (
        <Sprite
          key={mon.id}
          spriteId={mon.name.toLowerCase().replace(/\s+/g, '')}
          name={mon.name}
          state={animStates[mon.id] || (mon.is_ko ? 'ko' : 'idle')}
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
          state={animStates[mon.id] || (mon.is_ko ? 'ko' : 'idle')}
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
