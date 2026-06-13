import { useState, useCallback } from 'react'
import { api } from '../lib/invoke'
import type { Monster } from '../lib/invoke'
import { listen } from '@tauri-apps/api/event'

type DraftSlot = 1 | 2 | 3

interface DraftPick {
  slot: DraftSlot
  monster: Monster
}

export type DraftStatus =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'poll_1'; pool: Monster[] }
  | { phase: 'poll_2'; pool: Monster[]; picks: DraftPick[] }
  | { phase: 'poll_3'; pool: Monster[]; picks: DraftPick[] }
  | { phase: 'complete'; picks: DraftPick[]; chatTeam: Monster[] }
  | { phase: 'error'; message: string }

interface UseChatDraftOptions {
  allMonsters: Monster[]
  streamerMonsterIds: number[]
  pollDurationSecs?: number
}

const POLL_DURATION = 10 // short for test mode

/**
 * State machine for the 3-poll chat draft.
 *
 * Orchestrates sequential polls via `api.startPoll`, listens for results,
 * encodes picks as `name::id`, handles pool underflow.
 */
export function useChatDraft({ allMonsters, streamerMonsterIds, pollDurationSecs = POLL_DURATION }: UseChatDraftOptions) {
  const [status, setStatus] = useState<DraftStatus>({ phase: 'idle' })

  // Available pool = all monsters minus streamer's picks
  const streamerSet = new Set(streamerMonsterIds)
  const availablePool = allMonsters.filter(m => !streamerSet.has(m.id))

  /** Start the draft sequence. */
  const start = useCallback(async () => {
    if (availablePool.length < 1) {
      setStatus({ phase: 'error', message: 'No monsters available for chat draft!' })
      return
    }
    setStatus({ phase: 'starting' })

    // Shuffle available pool
    const pool = [...availablePool].sort(() => Math.random() - 0.5)
    const picks: DraftPick[] = []

    // Determine how many polls to run (max 3, capped by pool size)
    const numPolls = Math.min(3, pool.length)
    let remaining = [...pool]

    for (let slot = 1; slot <= numPolls; slot++) {
      setStatus({ phase: slot === 1 ? 'poll_1' : slot === 2 ? 'poll_2' : 'poll_3' as any, pool: remaining, picks: [...picks] })

      // Build choices: up to 4 monsters from remaining pool
      const choices = remaining.slice(0, 4).map(m => `${m.name}::${m.id}`)

      // Start the poll
      let choice: string
      try {
        const result = await api.startPoll(`Chat Pick Slot ${slot} — Choose your monster!`, choices, pollDurationSecs)
        // In test mode, result is immediate; wait for poll-result event
        choice = result === 'test-mode' ? await waitForResult() : result
      } catch (e: any) {
        setStatus({ phase: 'error', message: String(e) })
        return
      }

      // Parse the result
      const [, idStr] = choice.split('::')
      const pickedId = parseInt(idStr, 10)
      const pickedMon = remaining.find(m => m.id === pickedId)

      if (!pickedMon) {
        // Fallback: pick first from pool
        picks.push({ slot: slot as DraftSlot, monster: remaining[0] })
      } else {
        picks.push({ slot: slot as DraftSlot, monster: pickedMon })
      }

      // Remove from remaining pool
      remaining = remaining.filter(m => m.id !== pickedId)
    }

    setStatus({ phase: 'complete', picks, chatTeam: picks.map(p => p.monster) })
  }, [availablePool, pollDurationSecs])

  const reset = useCallback(() => {
    setStatus({ phase: 'idle' })
  }, [])

  return { status, start, reset }
}

/** Promise that resolves on the next poll-result event. */
function waitForResult(): Promise<string> {
  return new Promise(resolve => {
    const unlisten = listen<string>('poll-result', (e) => {
      unlisten.then(f => f())
      resolve(e.payload)
    })
  })
}
