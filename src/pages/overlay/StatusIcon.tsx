const STATUS_ICONS: Record<string, string> = {
  Burn: '🔥', Poison: '☠️', Freeze: '❄️', Stun: '⚡',
  Blind: '👁️', Slow: '🐌', Fear: '😱', Bleeding: '🩸', Sleep: '💤',
}

export interface StatusState {
  name: string
  turns_left: number
  intensity: number
}

export default function StatusIcon({ status }: { status: StatusState }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '1px 4px',
    }}>
      <span style={{ fontSize: 12 }}>{STATUS_ICONS[status.name] || '❓'}</span>
      <span style={{ fontSize: 9, color: '#fff' }}>{status.turns_left}</span>
    </div>
  )
}
