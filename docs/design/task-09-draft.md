# Task 09: Draft System

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Implement pre-stream streamer draft (lineup selection) and per-round chat draft via 3 sequential Twitch polls.

**Architecture:** Streamer draft is saved to SQLite as active_lineup. Chat draft runs 3 sequential Twitch polls at battle start. Each poll presents 4 monsters from remaining pool. RNG wildcard optionally injected as extra option.

**Tech Stack:** Tauri invoke, Twitch polls, React dashboard UI

---

### Step 1: DB table for streamer lineup
```sql
-- Add to migrations.rs
CREATE TABLE IF NOT EXISTS streamer_lineup (
    id INTEGER PRIMARY KEY DEFAULT 1,
    hunter_id INTEGER REFERENCES hunters(id),
    slot1_monster_id INTEGER REFERENCES monsters(id),
    slot2_monster_id INTEGER REFERENCES monsters(id),
    slot3_monster_id INTEGER REFERENCES monsters(id)
);
```

---

### Step 2: Lineup commands
```rust
// src-tauri/src/commands/battle.rs
#[tauri::command]
pub fn save_streamer_lineup(
    state: State<AppState>,
    hunter_id: i64,
    monster_ids: Vec<i64>,  // exactly 3
) {
    let db = state.db.lock().unwrap();
    db.execute(
        "INSERT OR REPLACE INTO streamer_lineup (id, hunter_id, slot1_monster_id, slot2_monster_id, slot3_monster_id)
         VALUES (1, ?1, ?2, ?3, ?4)",
        (hunter_id, monster_ids[0], monster_ids[1], monster_ids[2]),
    ).unwrap();
}

#[tauri::command]
pub fn get_streamer_lineup(state: State<AppState>) -> serde_json::Value {
    // Returns hunter + 3 monsters with full stats
}
```

---

### Step 3: Streamer lineup UI (pre-stream)
```tsx
// src/pages/dashboard/LineupBuilder.tsx
// Monster pool grid — click to add to slot (max 3)
// Hunter selector dropdown (v1: only 1 Hunter)
// Selected slots shown as 3 portrait cards
// "Save Lineup" button → invoke('save_streamer_lineup', ...)
// Shows currently saved lineup on load

export function LineupBuilder() {
  const [pool, setPool] = useState<Monster[]>([])
  const [selected, setSelected] = useState<Monster[]>([])
  const [hunter, setHunter] = useState<Hunter | null>(null)

  const toggleMonster = (mon: Monster) => {
    if (selected.find(m => m.id === mon.id)) {
      setSelected(selected.filter(m => m.id !== mon.id))
    } else if (selected.length < 3) {
      setSelected([...selected, mon])
    }
  }
  // ...
}
```

---

### Step 4: Chat draft state machine
```ts
// src/lib/draft.ts
type DraftState =
  | { phase: 'idle' }
  | { phase: 'poll_1', remaining: Monster[] }
  | { phase: 'poll_2', remaining: Monster[], picked: Monster[] }
  | { phase: 'poll_3', remaining: Monster[], picked: Monster[] }
  | { phase: 'complete', chatTeam: Monster[] }
```

---

### Step 5: Draft orchestrator command (Rust)
```rust
// Manages 3 sequential polls — waits for each result before starting next
// Each poll: "Chat Pick Slot N — Choose your monster!"
// Choices: up to 4 monster names from remaining pool (+ RNG wildcard if enabled)
// On poll end: remove winner from pool, start next poll
// After 3 polls: emit 'draft-complete' event with chat_team

#[tauri::command]
pub async fn run_chat_draft(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    available_monster_ids: Vec<i64>,
    rng_wildcard: bool,
    poll_duration_secs: u32,
) -> Vec<i64>  // returns 3 chosen monster ids
```

---

### Step 6: RNG wildcard injection
```rust
// In run_chat_draft: if rng_wildcard == true
// Pick 1 random monster NOT in available_monster_ids
// Add it as an extra option in poll 3 only
// If wildcard wins the poll: add to chat team regardless
```

---

### Step 7: Draft UI in dashboard
```tsx
// src/pages/dashboard/DraftPhase.tsx
// Shows during draft phase
// Live view: "Chat is picking Slot 1..." with spinner
// Shows each monster picked as draft resolves
// On draft complete: shows final 3 chat monsters + proceeds to battle start
```

---

### Step 8: Emit draft-complete to overlay
```rust
// After 3 polls complete:
app.emit("draft-complete", json!({ "chat_team": chat_team_ids })).unwrap();
```
```tsx
// Overlay.tsx listens and updates chat_team display
listen('draft-complete', (e) => setChatTeam(e.payload.chat_team))
```

---

### Step 9: Commit
```bash
git add .
git commit -m "feat: draft system — streamer lineup builder, chat draft via 3 twitch polls, RNG wildcard"
```
