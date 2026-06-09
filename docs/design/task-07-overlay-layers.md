# Task 07: OBS Overlay — Layer System

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Build the 4-layer overlay rendered at /overlay. OBS points a browser source here at 1920x1080.

**Architecture:** Each layer is an absolutely positioned div stacked via z-index. Layer 1 = background, Layer 2 = sprites, Layer 3 = environment/parallax, Layer 4 = UI. Sprite animations via CSS keyframes + spritesheet background-position stepping.

**Tech Stack:** React, CSS, Tauri event listener

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
```tsx
// src/pages/overlay/Sprite.tsx
type SpriteState = 'idle' | 'attack' | 'damaged' | 'ko'

interface SpriteProps {
  spriteId: string
  state: SpriteState
  isActive: boolean
  isKo: boolean
  flipX?: boolean
}

export function Sprite({ spriteId, state, isActive, isKo, flipX }: SpriteProps) {
  // Spritesheets live at /public/sprites/{spriteId}.png
  // Each state = column offset in spritesheet
  // CSS animation steps through frames at 8fps
  const stateOffsets: Record<SpriteState, number> = {
    idle: 0, attack: 1, damaged: 2, ko: 3
  }
  return (
    <div style={{
      width: 64, height: 64,
      backgroundImage: `url(/sprites/${spriteId}.png)`,
      backgroundPositionY: `-${stateOffsets[state] * 64}px`,
      filter: isKo ? 'grayscale(100%) opacity(50%)' : isActive ? 'drop-shadow(0 0 8px #fff)' : 'none',
      transform: flipX ? 'scaleX(-1)' : 'none',
      imageRendering: 'pixelated',
      animation: state === 'idle' ? 'sprite-idle 0.8s steps(4) infinite' : undefined,
    }} />
  )
}
```
```css
@keyframes sprite-idle {
  from { background-position-x: 0; }
  to   { background-position-x: -256px; } /* 4 frames × 64px */
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

### Step 8: Connect overlay to battle state via Tauri events
```tsx
// src/pages/overlay/Overlay.tsx
import { listen } from '@tauri-apps/api/event'

useEffect(() => {
  const unlisten = listen('battle-state-update', (e) => {
    setBattleState(e.payload as BattleState)
  })
  return () => { unlisten.then(f => f()) }
}, [])
```

---

### Step 9: Commit
```bash
git add .
git commit -m "feat: overlay layer system — background, environment, sprites, running scene"
```
