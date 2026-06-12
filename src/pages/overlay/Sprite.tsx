import { CSSProperties } from 'react'

export type SpriteState = 'idle' | 'attack' | 'damaged' | 'ko'

/// Color palette for the 12 default monsters.
const PALETTE: Record<string, string> = {
  emberwolf: '#ff4400',
  flamecrow: '#ff8800',
  tidalfin: '#0088ff',
  stormray: '#00ccff',
  stoneback: '#885522',
  mudcrawler: '#664422',
  galebird: '#88ddff',
  driftfang: '#66bbcc',
  voidshade: '#442266',
  grimspawn: '#553377',
  dawnwing: '#ffdd44',
  solarclaw: '#ffcc00',
}

/// Animation class for each sprite state.
const ANIMATION_CLASS: Record<SpriteState, string | undefined> = {
  idle: 'sprite-idle',
  attack: 'sprite-lunge',
  damaged: 'sprite-flinch',
  ko: undefined,
}

interface SpriteProps {
  spriteId: string
  name: string
  state: SpriteState
  isActive: boolean
  isKo: boolean
  flipX?: boolean
  style?: CSSProperties
}

/// Sprite component — colored rectangle with first letter and animation.
/// No image files required. Replaces with pixel art later.
export default function Sprite({ spriteId, name, state, isKo, flipX, style }: SpriteProps) {
  const isIdle = state === 'idle'
  const color = PALETTE[spriteId] || '#888'
  const animClass = isKo ? undefined : ANIMATION_CLASS[state]

  return (
    <div
      className={animClass}
      style={{
        width: 72,
        height: 72,
        backgroundColor: color,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
        filter: isKo
          ? 'grayscale(100%) opacity(50%)'
          : isIdle
            ? 'none'
            : 'drop-shadow(0 0 8px #fff)',
        transform: flipX ? 'scaleX(-1)' : 'none',
        imageRendering: 'pixelated',
        transition: 'filter 0.3s ease',
        animation: animClass ? `${animClass} 0.6s ease-out` : undefined,
        ...style,
      }}
    >
      {name[0].toUpperCase()}
    </div>
  )
}
