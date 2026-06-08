# Task 12: Battle History & Stats

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Build history page (turn-by-turn battle replays) and stats/analytics page (win rates, most used monsters, streamer vs chat ratio).

**Architecture:** Read from battle_logs table via Tauri invoke. History page renders turn log as a timeline. Stats page aggregates data client-side from all logs.

**Tech Stack:** React, Tauri invoke, recharts (bar/pie charts)

---

### Step 1: History list page
```tsx
// src/pages/history/History.tsx
// Load all battle logs via invoke('get_battle_logs')
// List: date, winner side badge, streamer team (3 sprite thumbs), chat team (3 sprite thumbs), duration
// Click row → navigate to /history/:id
```

---

### Step 2: History detail page (turn replay)
```tsx
// src/pages/history/HistoryDetail.tsx
// Route: /history/:id
// Header: date, winner, team names, duration
// Turn timeline: vertical list of turns
// Each turn entry:
//   - Turn number
//   - Streamer move: [monster name] used [ability] → [damage] dmg (CRIT if applicable)
//   - Chat move: same format
//   - Status inflicted if any
//   - HP remaining for both active monsters after turn

export function TurnEntry({ turn, index }: { turn: TurnResult, index: number }) {
  return (
    <div style={{ borderLeft: '2px solid #333', paddingLeft: 12, marginBottom: 8 }}>
      <span style={{ color: '#666', fontSize: 11 }}>Turn {index + 1}</span>
      <div>{turn.attacker_name} → {turn.ability_used}: {turn.damage_dealt} dmg
        {turn.is_crit && <span style={{ color: '#fbbf24' }}> CRIT!</span>}
        {turn.status_inflicted && <span style={{ color: '#ef4444' }}> {turn.status_inflicted}!</span>}
      </div>
    </div>
  )
}
```

---

### Step 3: Battle log commands
```rust
// src-tauri/src/commands/battle.rs
#[tauri::command]
pub fn get_battle_logs(state: State<AppState>) -> Vec<BattleLog> {
    let db = state.db.lock().unwrap();
    // SELECT * FROM battle_logs ORDER BY date DESC LIMIT 50
}

#[tauri::command]
pub fn get_battle_log(state: State<AppState>, id: i64) -> Option<BattleLog> {
    // SELECT * FROM battle_logs WHERE id = ?1
}
```

---

### Step 4: Stats aggregation
```ts
// src/lib/stats.ts
export function computeStats(logs: BattleLog[]) {
  const total = logs.length
  const streamerWins = logs.filter(l => l.winner_side === 'streamer').length
  const chatWins = logs.filter(l => l.winner_side === 'chat').length

  // Monster usage: flatten all teams, count appearances
  const monsterUsage = countBy(logs.flatMap(l => [...l.streamer_team, ...l.chat_team]))

  // Top 5 most picked monsters
  const topMonsters = sortByCount(monsterUsage).slice(0, 5)

  return { total, streamerWins, chatWins, topMonsters }
}
```

---

### Step 5: Stats page
```tsx
// src/pages/stats/Stats.tsx
// Section 1: Win Ratio
//   - Large numbers: "Streamer X wins | Chat Y wins"
//   - Pie chart (recharts) showing ratio

// Section 2: Most Picked Monsters
//   - Bar chart (recharts) top 5 monsters by pick count
//   - X axis: monster name, Y axis: times picked

// Section 3: Battle count + avg duration
//   - "N battles played, avg Xm Ys per battle"

import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
```

---

### Step 6: Nav links to history + stats
```tsx
// Add to dashboard nav:
// /history → Battle History
// /stats → Analytics
```

---

### Step 7: Commit
```bash
git add .
git commit -m "feat: battle history turn replay and stats analytics page"
```
