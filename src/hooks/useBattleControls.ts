import { useState, useCallback, useEffect, useRef } from 'react'
import { api, type BattleState as BState, type Ability } from '../lib/invoke'
import type { AbilityInput } from '../lib/invoke'
import { listen } from '@tauri-apps/api/event'

export type BattlePhase =
  | 'loading'
  | 'idle'           // battle loaded, waiting to start first turn
  | 'streamer_pick'  // streamer selects move
  | 'poll_active'    // poll running for chat's move
  | 'resolving'      // processing turn
  | 'turn_result'    // showing result
  | 'battle_over'    // winner declared

export interface TurnDisplay {
  number: number
  streamerAbility: string
  chatAbility: string
  log: any[]
}

export interface Settings {
  pollDuration: number
  fallback: 'random' | 'basic'
}

interface UseBattleControlsReturn {
  phase: BattlePhase
  battle: BState | null
  activeStreamerIdx: number
  activeChatIdx: number
  streamerAbilities: Ability[]
  chatAbilities: Ability[]
  streamerMove: AbilityInput | null
  turnDisplay: TurnDisplay | null
  lastResult: BState | null
  settings: Settings
  setSettings: (s: Settings) => void
  setStreamerMove: (move: AbilityInput) => void
  startTurn: () => Promise<void>
  continueAfterResult: () => void
  surrender: () => Promise<void>
  error: string
}

const BASIC_ATTACK: AbilityInput = {
  name: 'Basic Attack',
  base_power: 10,
  ability_type: 'physical',
  status_inflict_name: null,
  status_duration: 0,
}

/**
 * Battle controls hook — state machine for the turn loop.
 */
export function useBattleControls(): UseBattleControlsReturn {
  const [phase, setPhase] = useState<BattlePhase>('loading')
  const [battle, setBattle] = useState<BState | null>(null)
  const [streamerMove, setStreamerMove] = useState<AbilityInput | null>(null)
  const [turnDisplay, setTurnDisplay] = useState<TurnDisplay | null>(null)
  const [lastResult, setLastResult] = useState<BState | null>(null)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<Settings>({ pollDuration: 30, fallback: 'random' })
  const [streamerAbilities, setStreamerAbilities] = useState<Ability[]>([])
  const [chatAbilities, setChatAbilities] = useState<Ability[]>([])

  const pollCbRef = useRef<((choice: string) => void) | null>(null)
  const onGoingRef = useRef(false)

  // Subscribe to poll-result events
  useEffect(() => {
    const unlisten = listen<string>('poll-result', (e) => {
      pollCbRef.current?.(e.payload)
    })
    return () => { unlisten.then(f => f()) }
  }, [])

  // Load current battle state on mount
  useEffect(() => {
    api.getBattleState()
      .then(bs => {
        setBattle(bs)
        if (bs.phase === 'battle' && !bs.winner) {
          loadAbilities(bs)
          setPhase('streamer_pick')
        } else if (bs.winner) {
          setPhase('battle_over')
        } else {
          setPhase('idle')
        }
      })
      .catch(e => setError(String(e)))
  }, [])

  const loadAbilities = useCallback(async (bs: BState) => {
    const si = bs.streamer_team.findIndex(m => !m.is_ko)
    const ci = bs.chat_team.findIndex(m => !m.is_ko)
    if (si >= 0) {
      try {
        setStreamerAbilities(await api.getAbilitiesForMonster(bs.streamer_team[si].id))
      } catch { setStreamerAbilities([]) }
    }
    if (ci >= 0) {
      try {
        setChatAbilities(await api.getAbilitiesForMonster(bs.chat_team[ci].id))
      } catch { setChatAbilities([]) }
    }
  }, [])

  const activeStreamerIdx = battle ? battle.streamer_team.findIndex(m => !m.is_ko) : -1
  const activeChatIdx = battle ? battle.chat_team.findIndex(m => !m.is_ko) : -1

  const startTurn = useCallback(async () => {
    if (!battle || onGoingRef.current) return
    onGoingRef.current = true

    try {
      // Load chat's abilities for the poll
      const ci = battle.chat_team.findIndex(m => !m.is_ko)
      if (ci < 0) {
        setError('No active chat monster!')
        onGoingRef.current = false
        return
      }
      let chatAbils: Ability[] = []
      try {
        chatAbils = await api.getAbilitiesForMonster(battle.chat_team[ci].id)
      } catch { chatAbils = [] }

      // Build poll choices
      const choices = chatAbils.map(a => `${a.name}::${a.id}`)
      choices.push('Basic Attack::0')

      setPhase('poll_active')

      // Wait for poll result via event
      const result = await new Promise<string>(resolve => {
        pollCbRef.current = resolve
        api.startPoll('Chat — Choose your monster\'s move!', choices, settings.pollDuration).catch(e => {
          setError(String(e))
          resolve('Basic Attack::0')
        })
      })
      pollCbRef.current = null

      // Parse chat's choice
      const [, idStr] = result.split('::')
      const chatAbilityId = parseInt(idStr, 10)
      let chatMove: AbilityInput
      if (chatAbilityId === 0) {
        chatMove = BASIC_ATTACK
      } else {
        chatMove = await api.getAbilityInput(chatAbilityId)
      }

      // Streamer's move (use Basic Attack if none selected)
      const sMove = streamerMove || BASIC_ATTACK

      setPhase('resolving')

      // Resolve the turn
      const updated = await api.resolveTurn(sMove, chatMove)
      setBattle(updated)
      setLastResult(updated)
      setTurnDisplay({
        number: updated.turn_number,
        streamerAbility: sMove.name,
        chatAbility: chatMove.name,
        log: updated.turn_log,
      })
      setStreamerMove(null)

      // Check for winner
      if (updated.winner) {
        setPhase('battle_over')
      } else {
        // Reload abilities for the next turn
        await loadAbilities(updated)
        setPhase('turn_result')
      }
    } catch (e: any) {
      setError(String(e))
      setPhase('streamer_pick')
    }
    onGoingRef.current = false
  }, [battle, streamerMove, settings.pollDuration, loadAbilities])

  const continueAfterResult = useCallback(() => {
    if (battle?.winner) {
      setPhase('battle_over')
    } else {
      setPhase('streamer_pick')
    }
    setTurnDisplay(null)
  }, [battle])

  const surrenderFn = useCallback(async () => {
    try {
      const updated = await api.surrender('chat')
      setBattle(updated)
      setPhase('battle_over')
    } catch (e: any) {
      setError(String(e))
    }
  }, [])

  return {
    phase, battle, activeStreamerIdx, activeChatIdx,
    streamerAbilities, chatAbilities,
    streamerMove, setStreamerMove,
    turnDisplay, lastResult,
    settings, setSettings,
    startTurn, continueAfterResult,
    surrender: surrenderFn, error,
  }
}
