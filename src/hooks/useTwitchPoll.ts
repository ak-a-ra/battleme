import { listen } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'

/**
 * Listen for `poll-result` events emitted by the Rust backend.
 *
 * Used by the Dashboard (Tauri window). The OBS overlay does NOT use this —
 * it polls the HTTP bridge (port 38021) instead.
 */
export function useTwitchPoll(): string | null {
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    const unlisten = listen<string>('poll-result', (e) => {
      setResult(e.payload)
    })
    return () => {
      unlisten.then((f) => f())
    }
  }, [])

  // Reset after each poll cycle — consumer should clear after reading
  useEffect(() => {
    if (result !== null) {
      const timer = setTimeout(() => setResult(null), 100)
      return () => clearTimeout(timer)
    }
  }, [result])

  return result
}
