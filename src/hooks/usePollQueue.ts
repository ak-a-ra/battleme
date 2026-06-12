import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'

/**
 * Subscribe to `poll-result` events via callback.
 *
 * Unlike `useTwitchPoll` (which has auto-reset state), this fires synchronously
 * on each event — no race condition for sequential polls.
 */
export function usePollQueue(onResult: (choice: string) => void) {
  const cbRef = useRef(onResult)
  cbRef.current = onResult

  useEffect(() => {
    const unlisten = listen<string>('poll-result', (e) => {
      cbRef.current(e.payload)
    })
    return () => { unlisten.then(f => f()) }
  }, [])
}
