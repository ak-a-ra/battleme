import { CSSProperties } from 'react'

/// Color palette for the 12 default monsters.
/// Same palette as overlay's Sprite.tsx — single source of truth.
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

interface SpritePlaceholderProps {
  spriteId: string
  name: string
  size?: number
  style?: CSSProperties
}

/// Renders a colored rectangle with first letter of the name.
/// No image files required. Shared between overlay and wiki.
export default function SpritePlaceholder({ spriteId, name, size = 64, style }: SpritePlaceholderProps) {
  const color = PALETTE[spriteId] || '#888'
  const letter = name ? name[0].toUpperCase() : '?'

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.round(size * 0.12),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.4),
        fontWeight: 'bold',
        color: '#fff',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
        imageRendering: 'pixelated',
        flexShrink: 0,
        ...style,
      }}
    >
      {letter}
    </div>
  )
}

export { PALETTE }
