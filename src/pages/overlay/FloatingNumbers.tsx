import { useEffect, useState } from 'react'
import { Z } from './layers'

export interface Floater {
  id: string
  text: string
  x: number
  y: number
  isCrit: boolean
  color: string
}

interface Props {
  floaters: Floater[]
  onRemove: (id: string) => void
}

/// Floating damage numbers — animate up and fade out over 1.5s.
export default function FloatingNumbers({ floaters, onRemove }: Props) {
  return (
    <>
      {floaters.map(f => (
        <FloaterItem key={f.id} floater={f} onRemove={onRemove} />
      ))}
    </>
  )
}

function FloaterItem({ floater, onRemove }: { floater: Floater; onRemove: (id: string) => void }) {
  const [alive, setAlive] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAlive(false)
      onRemove(floater.id)
    }, 1500)
    return () => clearTimeout(timer)
  }, [floater.id, onRemove])

  if (!alive) return null

  return (
    <div style={{
      position: 'absolute',
      left: floater.x,
      top: floater.y,
      zIndex: Z.FLOATERS,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      fontSize: floater.isCrit ? 28 : 20,
      color: floater.color,
      textShadow: '2px 2px 0 #000',
      pointerEvents: 'none',
      animation: 'float-up 1.5s ease-out forwards',
    }}>
      {floater.text}
    </div>
  )
}
