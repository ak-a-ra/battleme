import { useState, useEffect } from 'react'
import { Z } from './layers'

interface Props {
  totalSecs: number
  remainingSecs: number
}

/// Turn timer — top strip countdown bar.
/// Color transitions from green → yellow → red.
export default function TurnTimer({ totalSecs, remainingSecs }: Props) {
  const pct = totalSecs > 0 ? Math.max(0, (remainingSecs / totalSecs) * 100) : 0
  const color = pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444'

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: 6,
      background: '#111',
      zIndex: Z.UI,
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: color,
        transition: 'width 1s linear',
      }} />
    </div>
  )
}

/// Hook that counts down from totalSecs and resets when totalSecs changes.
export function useCountdown(totalSecs: number): number {
  const [remaining, setRemaining] = useState(totalSecs)

  useEffect(() => {
    setRemaining(totalSecs)
    if (totalSecs <= 0) return

    const id = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [totalSecs])

  return remaining
}
