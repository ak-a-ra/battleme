# Task 07: OBS Overlay — Layer System

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Build the 4-layer overlay rendered at /overlay. OBS points a browser source here at 1920x1080.

**Architecture:** Each layer is an absolutely positioned div stacked via z-index. Layer 1 = background, Layer 2 = sprites, Layer 3 = environment/parallax, Layer 4 = UI. All battle state comes from HTTP polling (`useBattleState`), NOT from Tauri IPC — OBS browser sources cannot use IPC. Sprite animations via CSS keyframes + background-position.

**Tech Stack:** React, CSS, HTTP fetch polling

---

### Step 1: Overlay route at fixed 1920x1080
```tsx
// src/pages/overlay/Overlay.tsx
export default function Overlay() {
  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', background: '#000' }}>
      <BackgroundLayer />
      <SpriteLayer />
      <EnvironmentLayer />
      <UILayer />
    </div>
  )
}
```

---

### Step 2: Layer stacking constants
```ts
// src/pages/overlay/layers.ts
export const Z = {
  BACKGROUND:   1,
  SPRITES:      2,
  ENVIRONMENT:  3,
  UI:           4,
  FLOATERS:     5,  // damage numbers float above all
}

// Overlay is footer-style — sprites live in bottom 30% of screen
export const BATTLE_FLOOR_Y = 720  // px from top where ground line sits

export const BRIDGE_URL = 'http://localhost:38021'
export const POLL_INTERVAL = 1000  // 1s polling for battle state
```

---

### Step 3: Background layer
```tsx
// src/pages/overlay/BackgroundLayer.tsx
// Props: src (image/gif path), isAnimated (bool)
// Fills entire 1920x1080 behind all other layers
// Reads current background from battle state via Tauri event

export function BackgroundLayer({ src }: { src: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      zIndex: Z.BACKGROUND,
      backgroundImage: `url(${src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }} />
  )
}
```

---

### Step 4: Environment layer (parallax floor)
```tsx
// src/pages/overlay/EnvironmentLayer.tsx
// Three sublayers: sky, ground, trees
// Trees scroll left slowly using CSS animation (parallax effect)

export function EnvironmentLayer() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.ENVIRONMENT }}>
      {/* Ground strip */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 120,
        background: 'linear-gradient(to top, #2d4a1e, transparent)',
      }} />
      {/* Tree strip — scrolling */}
      <div className="trees-scroll" style={{
        position: 'absolute',
        bottom: 80,
        // repeated tree sprites via background-image repeat-x
      }} />
    </div>
  )
}
```
```css
/* src/pages/overlay/overlay.css */
@keyframes scroll-left {
  from { background-position-x: 0; }
  to   { background-position-x: -1920px; }
}
.trees-scroll {
  animation: scroll-left 20s linear infinite;
  background-repeat: repeat-x;
  height: 200px;
  width: 100%;
}
```

---

### Step 5: Sprite component (single monster or hunter)

**Placeholder sprites:** No image files needed. Render a colored rectangle with the first letter of the sprite ID. Real pixel art can replace later without code changes.

```tsx
// src/pages/overlay/Sprite.tsx
type SpriteState = 'idle' | 'attack' | 'damaged' | 'ko'

const PALETTE: Record<string, string> = {
  emberwolf: '#ff4400', flamecrow: '#ff8800',
  tidalfin: '#0088ff',  stormray: '#00ccff',
  stoneback: '#885522', mudcrawler: '#664422',
  galebird: '#88ddff',  driftfang: '#66bbcc',
  voidshade: '#442266', grimspawn: '#553377',
  dawnwing: '#ffdd44',  solarclaw: '#ffcc00',
}

interface SpriteProps {
  spriteId: string
  state: SpriteState
  isActive: boolean
  isKo: boolean
  flipX?: boolean
}

export function Sprite({ spriteId, state, isActive, isKo, flipX }: SpriteProps) {
  const isIdle = state === 'idle'
  return (
    <div style={{
      width: 64, height: 64,
      backgroundColor: PALETTE[spriteId] || '#888',
      borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 24, fontWeight: 'bold', color: '#fff',
      filter: isKo ? 'grayscale(100%) opacity(50%)' : isActive ? 'drop-shadow(0 0 8px #fff)' : 'none',
      transform: flipX ? 'scaleX(-1)' : 'none',
      imageRendering: 'pixelated',
      animation: isIdle ? 'sprite-idle 0.8s steps(4) infinite' : undefined,
    }}>
      {spriteId[0].toUpperCase()}
    </div>
  )
}
```
```css
@keyframes sprite-idle {
  from { opacity: 0.6; }
  to   { opacity: 1; }
}
```

---

### Step 6: Sprite layer — positions all monsters + hunter
```tsx
// src/pages/overlay/SpriteLayer.tsx
// Streamer side: Hunter (far left) + 3 monsters in a row
// Chat side: 3 monsters in a row (flipped, facing left)
// All sit at BATTLE_FLOOR_Y

export function SpriteLayer({ battle }: { battle: BattleState }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.SPRITES }}>
      {/* Hunter — left side */}
      <Sprite spriteId={battle.hunter.sprite_id} state="idle"
        isActive={false} isKo={false}
        style={{ position: 'absolute', left: 80, top: BATTLE_FLOOR_Y - 64 }}
      />
      {/* Streamer monsters */}
      {battle.streamer_team.map((mon, i) => (
        <Sprite key={mon.id} spriteId={mon.sprite_id}
          state={mon.is_ko ? 'ko' : battle.active_streamer === i ? 'idle' : 'idle'}
          isActive={battle.active_streamer === i}
          isKo={mon.is_ko}
          style={{ position: 'absolute', left: 180 + i * 120, top: BATTLE_FLOOR_Y - 64 }}
        />
      ))}
      {/* Chat monsters — flipped */}
      {battle.chat_team.map((mon, i) => (
        <Sprite key={mon.id} spriteId={mon.sprite_id}
          state={mon.is_ko ? 'ko' : 'idle'}
          isActive={battle.active_chat === i}
          isKo={mon.is_ko} flipX
          style={{ position: 'absolute', right: 80 + i * 120, top: BATTLE_FLOOR_Y - 64 }}
        />
      ))}
    </div>
  )
}
```

---

### Step 7: Post-battle running scene
```tsx
// src/pages/overlay/RunningScene.tsx
// Triggered after winner declared
// Hunter sprite in 'walk' animation, moves from left to right across screen
// Trees parallax scrolls fast
// Fades out after 4 seconds → resets to battle view

export function RunningScene({ hunterSpriteId, onComplete }: RunningSceneProps) {
  // CSS animation: translateX(-100px) → translateX(2000px) over 3s
  // After 4s call onComplete()
}
```

---

### Step 8: Wire overlay to HTTP bridge (not Tauri IPC)

The overlay uses `useBattleState()` from Task 01-b to poll battle state. No `listen()` calls needed — OBS browser sources cannot use Tauri IPC:

```tsx
// src/pages/overlay/Overlay.tsx
import { useBattleState } from '../../hooks/useBattleState'

export default function Overlay() {
  const battle = useBattleState()

  if (!battle) {
    return <div style={{ width: 1920, height: 1080, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Waiting for battle...
    </div>
  }

  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', background: '#000' }}>
      <BackgroundLayer src={battle.background} />
      <SpriteLayer battle={battle} />
      <EnvironmentLayer />
      <UILayer battle={battle} />
    </div>
  )
}
```

---

### Step 9: Overlay OBS prod URL

```tsx
// Dashboard "Copy OBS URL" button:
const OBS_URL = import.meta.env.PROD
  ? 'http://localhost:38021/overlay'     // tiny_http serves overlay in prod
  : 'http://localhost:3000/overlay'       // Vite dev server in dev
```

---

### Step 10: Commit

```bash
git add .
git commit -m "feat: overlay layer system — background, environment, sprites, running scene, HTTP bridge integration"
```
