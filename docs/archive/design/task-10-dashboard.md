# Task 10: Dashboard — Streamer Battle Control

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Build the streamer's battle control dashboard — start battle, pick moves, surrender, configure per-round settings.

**Architecture:** React page with battle state machine. Communicates with Rust via invoke for battle actions. After each turn resolution, battle state is written to `Arc<RwLock<BattleState>>` (shared with the HTTP bridge). The overlay picks up changes by polling the bridge — no `emit` to overlay needed.

**Tech Stack:** React, Tauri invoke, useTwitchPoll hook, Arc<RwLock>

---

### Step 1: Dashboard battle state machine
```ts
// src/lib/battleMachine.ts
type BattlePhase =
  | 'idle'          // no battle running
  | 'draft'         // chat is picking monsters
  | 'turn_start'    // turn beginning, poll opened
  | 'poll_active'   // waiting for poll result
  | 'resolving'     // moves resolving, overlay animating
  | 'turn_end'      // turn complete, next turn pending
  | 'battle_over'   // winner declared
  | 'post_battle'   // running scene playing
```

---

### Step 2: Dashboard layout
```tsx
// src/pages/dashboard/Dashboard.tsx
// Left panel: battle controls (start, surrender, phase indicator)
// Center: current battle state (teams, HP, turn number)
// Right panel: streamer move selection (4 ability buttons + basic attack)
// Bottom: per-round settings (poll duration, fallback, RNG wildcard toggle)
```

---

### Step 3: Per-round settings panel
```tsx
// src/pages/dashboard/RoundSettings.tsx
export function RoundSettings({ settings, onChange }) {
  return (
    <div>
      <label>Poll Duration (seconds)</label>
      <input type="number" value={settings.pollDuration} min={5} max={3600}
        onChange={e => onChange('pollDuration', +e.target.value)} />

      <label>Timeout Fallback</label>
      <select value={settings.fallback} onChange={e => onChange('fallback', e.target.value)}>
        <option value="random">Random Move</option>
        <option value="basic">Basic Attack</option>
      </select>

      <label>
        <input type="checkbox" checked={settings.rngWildcard}
          onChange={e => onChange('rngWildcard', e.target.checked)} />
        RNG Wildcard for Chat Draft
      </label>
    </div>
  )
}
```

---

### Step 4: Start battle flow
```tsx
// 1. Save round settings
// 2. Load streamer lineup from DB
// 3. invoke('run_chat_draft', { available, rngWildcard, pollDuration })
// 4. On 'draft-complete' event → transition to 'turn_start'
// 5. invoke('start_turn', { battleState }) → opens Twitch poll
// 6. Dashboard shows move selector for streamer
```

---

### Step 5: Streamer move selector
```tsx
// src/pages/dashboard/MoveSelector.tsx
// Shows active monster's 4 abilities + basic attack
// Each button: ability name, MP cost, power, type
// Disabled if monster is KO or Stunned/Sleeping/Feared-locked
// Streamer clicks one → stored locally, not sent until poll resolves

export function MoveSelector({ monster, onSelect, disabled }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {monster.abilities.map(ability => (
        <button key={ability.id}
          disabled={disabled || monster.mp < ability.mp_cost}
          onClick={() => onSelect(ability)}>
          <span>{ability.name}</span>
          <span>{ability.mp_cost} MP</span>
          <TypeBadge type={ability.ability_type} />
        </button>
      ))}
      <button onClick={() => onSelect(null)}>Basic Attack (0 MP)</button>
    </div>
  )
}
```

---

### Step 6: Turn resolution flow
```tsx
// When poll result arrives via useTwitchPoll():
// 1. Get chat's chosen ability from poll winner
// 2. Get streamer's chosen ability (already selected)
// 3. invoke('resolve_turn', { battleState, streamerMove, chatMove })
// 4. Receive updated BattleState
// 5. Write updated state to Arc<RwLock<BattleState>> via invoke('update_battle_state', ...)
//    → overlay picks it up on next fetch poll
// 6. Check for KOs, winner, transition phase accordingly
```

---

### Step 7: Surrender button
```tsx
// "Surrender" button visible during poll_active and turn_end phases
// Shows confirmation modal: "Surrender this round?"
// On confirm: invoke('end_battle', { winner: 'chat' })
// Also write to Arc<RwLock<BattleState>> via invoke('update_battle_state', ...)
// Log to DB, transition to post_battle phase
```

---

### Step 8: Copy OBS URL button
```tsx
// In dashboard header
// Dev mode: port 3000 (Vite), Prod mode: port 38021 (tiny_http serves overlay static files)
const OBS_URL = import.meta.env.PROD
  ? 'http://localhost:38021/overlay'
  : 'http://localhost:3000/overlay'

<button onClick={() => navigator.clipboard.writeText(OBS_URL)}>
  📋 Copy OBS URL
</button>
```

---

### Step 9: Test mode toggle
```tsx
// In dashboard settings
// Toggle: "Test Mode (no Twitch required)"
// When on: poll results simulated by timer + fallback logic
// Overlay still works and animates normally
// Allows streamer to preview overlay layout before going live
```

---

### Step 10: Update_battle_state command

```rust
// src-tauri/src/commands/battle.rs (add)
#[tauri::command]
pub fn update_battle_state(
    state: State<AppState>,
    new_state: BattleState,
) {
    let mut bs = state.battle_state.write().unwrap();
    *bs = new_state;
}
```

Called from React after each turn resolution or surrender:
```ts
await invoke('update_battle_state', { newState: updatedBattleState })
```

---

### Step 11: Save battle result to DB
// src-tauri/src/commands/battle.rs
#[tauri::command]
pub fn save_battle_result(
    state: State<AppState>,
    winner_side: String,
    streamer_team: Vec<i64>,
    chat_team: Vec<i64>,
    turns: serde_json::Value,
    duration_secs: i64,
) {
    let db = state.db.lock().unwrap();
    db.execute(
        "INSERT INTO battle_logs (date, winner_side, streamer_team, chat_team, turns, duration_secs)
         VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5)",
        (&winner_side,
         serde_json::to_string(&streamer_team).unwrap(),
         serde_json::to_string(&chat_team).unwrap(),
         turns.to_string(),
         duration_secs),
    ).unwrap();
}
```

---

### Step 12: Commit
```bash
git add .
git commit -m "feat: dashboard — battle control, move selector, surrender, copy OBS URL, test mode"
```
