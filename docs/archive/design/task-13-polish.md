# Task 13: Polish — Sound Effects, Twitch Disconnect Recovery, UX Fixes

> **Status:** ✅ Completed in commits `fa6b631` (Rust) and `9375e6d` (Frontend)

**Goal:** Improve robustness and UX — auto-reconnect on Twitch EventSub disconnect, synthesized battle sounds, disconnect warning on overlay, Dashboard error visibility.

**Architecture:** Two-commit split. Rust side handles EventSub reconnect loop with exponential backoff and exposes `twitch_connected` via shared state. Frontend adds Web Audio API synthesized sounds (no file deps), disconnect banner, and fixes silent error swallowing.

**Tech Stack:** Rust (tokio-tungstenite, serde, tiny_http), TypeScript (Web Audio API, React)

---

## Commit 1: Rust Changes (`fa6b631`)

### Step 1: EventSub auto-reconnect
Extract the original EventSub WebSocket loop into `listen_once()`. Wrap the call site in a `loop` with exponential backoff:
- Initial delay: 1s
- Cap: 30s
- Reset on successful connection
- On disconnect: log warning, sleep, retry

```rust
// src-tauri/src/twitch/eventsub.rs
pub async fn listen(state: Arc<RwLock<BattleState>>, token: String, client_id: String, broadcaster_id: String) {
    let mut backoff = 1;
    loop {
        { state.write().unwrap().twitch_connected = false; }
        eprintln!("[eventsub] connecting...");
        if let Err(e) = listen_once(&state, &token, &client_id, &broadcaster_id).await {
            eprintln!("[eventsub] disconnected: {e}");
        }
        { state.write().unwrap().twitch_connected = false; }
        tokio::time::sleep(Duration::from_secs(backoff)).await;
        backoff = (backoff * 2).min(30);
    }
}
```

Set `twitch_connected = true` inside `listen_once()` after receiving `session_welcome`.

### Step 2: `twitch_connected` field on BattleState
```rust
// src-tauri/src/battle/types.rs
pub struct BattleState {
    // ...existing fields...
    pub twitch_connected: bool,
}
```
Default: `false`. Updated by EventSub listener on connect/disconnect. Serialized into `/api/battle-state` JSON and exposed via new `/api/status` endpoint.

### Step 3: `/api/status` endpoint
```rust
// src-tauri/src/bridge/mod.rs
(&tiny_http::Method::Get, "/api/status") => {
    let s = state.read().unwrap();
    let body = serde_json::json!({ "twitch_connected": s.twitch_connected }).to_string();
    json_ok(body)
}
```

### Step 4: Surrender double-save fix
Removed the duplicate `INSERT INTO battle_logs` from `surrender()` — only `save_battle_result` writes to the log now.

---

## Commit 2: Frontend Changes (`9375e6d`)

### Step 5: Synthesized battle sounds (`useSound.ts`)
Web Audio API synthesized sounds — zero file dependencies, works in OBS CEF browser:

| Sound | Waveform | Frequency | Duration |
|---|---|---|---|
| `attack` | sawtooth sweep | 400→800Hz | 150ms |
| `damage` | sine thud | 200Hz | 200ms |
| `crit` | square + sine sweep | 800→1600Hz + 1200→2400Hz | 200ms |
| `ko` | descending sawtooth | 600→100Hz | 400ms |
| `victory` | C-E-G major chord | 523+659+784Hz | 600ms |

```typescript
// src/pages/overlay/useSound.ts
export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const play = useCallback((type: SoundType) => {
    const ctx = getCtx()
    // ... oscillator/gain config per type
  }, [])
  return { play }
}
```

### Step 6: Wire sounds in Overlay.tsx
- New `turn_log` entries → play `attack`/`damage`/`crit` sound
- Winner change → play `victory`
- KO detected via `useEffect` on `turn_log.length` → play `ko`

### Step 7: Disconnect banner
CSS keyframe `pulse-warning` (opacity 0.9→0.4→0.9, 1.5s infinite). Rendered as a pulsing red bar at the top of the overlay when `!battle.twitch_connected`. Shown in idle, draft, and battle phase views.

### Step 8: Dashboard error visibility
- Fixed `catch {}` in `handleSaveResult` → displays error banner + `console.error`
- Fixed `getAbilityInput` silent `catch` → `console.error`
- OBS copy button shows "✓ Copied!" feedback for 2s

---

### Verification
```bash
cargo check                # clean
cargo test --lib           # 23/23 pass
tsc --noEmit               # clean
vite build                 # clean (653 modules, 659KB)
```

### Commit
```bash
git commit -m "feat: Twitch reconnect, twitch_connected flag, surrender double-save fix, /api/status"
git commit -m "feat: Synthesized battle sounds, disconnect banner, Dashboard error visibility"
```
