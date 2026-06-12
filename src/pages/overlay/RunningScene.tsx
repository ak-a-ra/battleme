import { useEffect, useState, useRef } from 'react'
import { BATTLE_FLOOR_Y } from './layers'

interface Props {
  onComplete: () => void
}

/// Post-battle running scene.
/// Triggered after winner declared. A "victory walk" animation:
/// A glowing rectangle (placeholder hunter) moves left-to-right,
/// trees scroll faster, scene fades out.
export default function RunningScene({ onComplete }: Props) {
  const [phase, setPhase] = useState<'running' | 'fading' | 'done'>('running')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // After 3s of running, start fade
    timerRef.current = setTimeout(() => {
      setPhase('fading')
    }, 3000)

    // After 4s total, complete
    const doneTimer = setTimeout(() => {
      setPhase('done')
      onComplete()
    }, 4000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      clearTimeout(doneTimer)
    }
  }, [onComplete])

  if (phase === 'done') return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        pointerEvents: 'none',
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 1s ease-out',
      }}
    >
      {/* Trees scroll faster during running scene */}
      <div
        className="trees-scroll-fast"
        style={{
          position: 'absolute',
          bottom: 80, left: 0, right: 0, height: 200,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 200'%3E%3Crect x='80' y='40' width='8' height='60' fill='%2344220a'/%3E%3Ccircle cx='84' cy='30' r='30' fill='%231a4a0a'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: '192px 200px',
        }}
      />

      {/* Victory walker (placeholder hunter) */}
      <div
        className="victory-walk"
        style={{
          position: 'absolute',
          top: BATTLE_FLOOR_Y - 72,
          width: 72,
          height: 72,
          backgroundColor: '#ffd700',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 'bold',
          color: '#000',
        }}
      >
        V
      </div>
    </div>
  )
}
