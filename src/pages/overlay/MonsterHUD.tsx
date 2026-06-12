import TypeBadge from './TypeBadge'
import StatusIcon from './StatusIcon'
import type { StatusState } from './StatusIcon'

interface MonsterHUDProps {
  name: string
  hp: number
  max_hp: number
  mp: number
  max_mp: number
  monster_type: string
  active_status: StatusState | null
  isActive?: boolean
}

/// Monster HUD — HP bar, MP bar, name, type badge, status icon.
export default function MonsterHUD({ name, hp, max_hp, mp, max_mp, monster_type, active_status, isActive }: MonsterHUDProps) {
  const hpPct = Math.max(0, Math.min(100, (hp / max_hp) * 100))
  const mpPct = Math.max(0, Math.min(100, (mp / max_mp) * 100))
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#eab308' : '#ef4444'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '4px 8px',
      background: 'rgba(0,0,0,0.7)',
      borderRadius: 6,
      border: isActive ? '1px solid #ffffff88' : '1px solid transparent',
      minWidth: 140,
    }}>
      {/* Name + type badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>{name}</span>
        <TypeBadge type={monster_type} />
      </div>

      {/* HP bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#aaa', width: 20 }}>HP</span>
        <div style={{ flex: 1, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${hpPct}%`, height: '100%', background: hpColor, transition: 'width 0.3s' }} />
        </div>
        {active_status && <StatusIcon status={active_status} />}
      </div>

      {/* MP bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#aaa', width: 20 }}>MP</span>
        <div style={{ flex: 1, height: 6, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${mpPct}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 9, color: '#666' }}>{mp}/{max_mp}</span>
      </div>
    </div>
  )
}
