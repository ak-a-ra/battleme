const TYPE_COLORS: Record<string, string> = {
  Fire:  '#ef4444',
  Water: '#3b82f6',
  Earth: '#84cc16',
  Wind:  '#06b6d4',
  Dark:  '#8b5cf6',
  Light: '#fbbf24',
}

const TYPE_ICONS: Record<string, string> = {
  Fire: '🔥', Water: '💧', Earth: '🌍', Wind: '🌀', Dark: '🌑', Light: '✨',
}

export default function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] || '#888'
  return (
    <span style={{
      fontSize: 9,
      padding: '1px 5px',
      background: color + '33',
      border: `1px solid ${color}`,
      borderRadius: 4,
      color,
      whiteSpace: 'nowrap',
    }}>
      {TYPE_ICONS[type] || ''} {type}
    </span>
  )
}
