# Task 08: Overlay — Battle UI Layer

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Build Layer 4 UI — HP/MP bars, status icons, floating damage numbers, turn timer, type badges.

**Architecture:** All UI elements are absolutely positioned divs above the sprite layer. Floating numbers are React state arrays that mount, animate up, then unmount after 1.5s.

**Tech Stack:** React, CSS keyframes, Tailwind

---

### Step 1: Monster HUD component (HP + MP bars + status icons)
```tsx
// src/pages/overlay/MonsterHUD.tsx
interface MonsterHUDProps {
  name: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  monsterType: string
  status: StatusState | null
  isActive: boolean
  side: 'left' | 'right'
}

export function MonsterHUD({ name, hp, maxHp, mp, maxMp, monsterType, status, isActive, side }: MonsterHUDProps) {
  const hpPct = (hp / maxHp) * 100
  const mpPct = (mp / maxMp) * 100
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
        <TypeBadge type={monsterType} />
      </div>

      {/* HP bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#aaa', width: 20 }}>HP</span>
        <div style={{ flex: 1, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${hpPct}%`, height: '100%', background: hpColor, transition: 'width 0.3s' }} />
        </div>
        {/* Status icons right of HP bar */}
        {status && <StatusIcon status={status} />}
      </div>

      {/* MP bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#aaa', width: 20 }}>MP</span>
        <div style={{ flex: 1, height: 6, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${mpPct}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 9, color: '#666', marginLeft: 2 }}>{mp}/{maxMp}</span>
      </div>
    </div>
  )
}
```

---

### Step 2: Type badge component
```tsx
// src/pages/overlay/TypeBadge.tsx
const TYPE_COLORS: Record<string, string> = {
  Fire:  '#ef4444', Water: '#3b82f6',
  Earth: '#84cc16', Wind:  '#06b6d4',
  Dark:  '#8b5cf6', Light: '#fbbf24',
}
const TYPE_ICONS: Record<string, string> = {
  Fire: '🔥', Water: '💧', Earth: '🌍', Wind: '🌀', Dark: '🌑', Light: '✨',
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      fontSize: 9, padding: '1px 5px',
      background: TYPE_COLORS[type] + '33',
      border: `1px solid ${TYPE_COLORS[type]}`,
      borderRadius: 4, color: TYPE_COLORS[type],
    }}>
      {TYPE_ICONS[type]} {type}
    </span>
  )
}
```

---

### Step 3: Status icon component
```tsx
// src/pages/overlay/StatusIcon.tsx
const STATUS_ICONS: Record<string, string> = {
  Burn: '🔥', Poison: '☠️', Freeze: '❄️', Stun: '⚡',
  Blind: '👁️', Slow: '🐌', Fear: '😱', Bleeding: '🩸', Sleep: '💤',
}

export function StatusIcon({ status }: { status: StatusState }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '1px 4px'
    }}>
      <span style={{ fontSize: 12 }}>{STATUS_ICONS[status.name]}</span>
      <span style={{ fontSize: 9, color: '#fff' }}>{status.turns_left}</span>
    </div>
  )
}
```

---

### Step 4: Floating damage number system
```tsx
// src/pages/overlay/FloatingNumbers.tsx
interface Floater {
  id: string
  text: string
  x: number
  y: number
  isCrit: boolean
  color: string
}

export function FloatingNumbers({ floaters }: { floaters: Floater[] }) {
  return (
    <>
      {floaters.map(f => (
        <div key={f.id} style={{
          position: 'absolute',
          left: f.x, top: f.y,
          zIndex: Z.FLOATERS,
          fontFamily: 'monospace',
          fontWeight: 'bold',
          fontSize: f.isCrit ? 28 : 20,
          color: f.color,
          textShadow: '2px 2px 0 #000',
          animation: 'float-up 1.5s ease-out forwards',
          pointerEvents: 'none',
        }}>
          {f.text}
        </div>
      ))}
    </>
  )
}
```
```css
@keyframes float-up {
  0%   { transform: translateY(0);    opacity: 1; }
  100% { transform: translateY(-80px); opacity: 0; }
}
```

---

### Step 5: Spawn floaters from turn results
```tsx
// In Overlay.tsx — when a TurnResult arrives
function spawnFloater(result: TurnResult, x: number, y: number) {
  const color = result.is_crit ? '#fbbf24' : '#ffffff'
  const text = result.damage_dealt === 0
    ? 'MISS'
    : result.is_crit
      ? `CRIT! ${result.damage_dealt}`
      : `${result.damage_dealt}`
  addFloater({ id: nanoid(), text, x, y, isCrit: result.is_crit, color })
  // Also spawn status text if status was inflicted
  if (result.status_inflicted) {
    addFloater({ id: nanoid(), text: result.status_inflicted.toUpperCase() + '!', x: x + 20, y: y - 20, isCrit: false, color: '#ff6b6b' })
  }
  // Remove after 1.5s
  setTimeout(() => removeFloater(id), 1500)
}
```

---

### Step 6: Turn timer bar
```tsx
// src/pages/overlay/TurnTimer.tsx
// Countdown bar across top of overlay
// Props: totalSecs, remainingSecs
// Color: green → yellow → red as time runs out

export function TurnTimer({ totalSecs, remainingSecs }: TurnTimerProps) {
  const pct = (remainingSecs / totalSecs) * 100
  const color = pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444'
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 6, background: '#111', zIndex: Z.UI,
    }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 1s linear' }} />
    </div>
  )
}
```

---

### Step 7: Full UI layer assembly
```tsx
// src/pages/overlay/UILayer.tsx
export function UILayer({ battle, timer }: UILayerProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.UI }}>
      <TurnTimer totalSecs={timer.total} remainingSecs={timer.remaining} />

      {/* Streamer HUDs — bottom left */}
      <div style={{ position: 'absolute', left: 20, bottom: 140, display: 'flex', gap: 8 }}>
        {battle.streamer_team.map((mon, i) => (
          <MonsterHUD key={mon.id} {...mon} isActive={battle.active_streamer === i} side="left" />
        ))}
      </div>

      {/* Chat HUDs — bottom right */}
      <div style={{ position: 'absolute', right: 20, bottom: 140, display: 'flex', gap: 8, flexDirection: 'row-reverse' }}>
        {battle.chat_team.map((mon, i) => (
          <MonsterHUD key={mon.id} {...mon} isActive={battle.active_chat === i} side="right" />
        ))}
      </div>

      {/* VS label center */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 48, fontWeight: 'black', color: '#fff',
        textShadow: '3px 3px 0 #000',
        fontFamily: 'monospace',
      }}>VS</div>

      <FloatingNumbers floaters={floaters} />
    </div>
  )
}
```

---

### Step 8: Commit
```bash
git add .
git commit -m "feat: overlay UI layer — HP/MP bars, status icons, floating numbers, turn timer"
```
