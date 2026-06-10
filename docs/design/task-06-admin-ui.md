# Task 06: Admin UI — CRUD + LLM Generate Stats

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Build admin pages for managing monsters, hunters, abilities, and status effects. Include "Generate Stats" button that calls Anthropic API to fill monster fields.

**Architecture:** React pages call Tauri invoke commands. LLM generation is a Rust command that calls Anthropic API, returns JSON stats, streamer edits before saving.

**Tech Stack:** React, Tailwind, Lucide, Tauri invoke, Anthropic API (reqwest)

---

### Step 1: Admin layout + nav
```tsx
// src/pages/admin/AdminLayout.tsx
import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/admin/monsters',  label: 'Monsters' },
  { to: '/admin/hunters',   label: 'Hunters' },
  { to: '/admin/abilities', label: 'Abilities' },
  { to: '/admin/status',    label: 'Status Effects' },
  { to: '/admin/settings',  label: 'Settings' },
]

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <nav className="w-48 border-r border-zinc-800 p-4 flex flex-col gap-2">
        {links.map(l => (
          <NavLink key={l.to} to={l.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm ${isActive ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`
            }>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-auto p-6"><Outlet /></main>
    </div>
  )
}
```

---

### Step 2: Monster list page
```tsx
// src/pages/admin/AdminMonsters.tsx
// - Table of all monsters with columns: name, type, hp, mp, stats
// - "Add Monster" button → opens form modal
// - "Edit" / "Delete" per row
// - "Generate Stats" button per row (calls LLM)
```

---

### Step 3: Monster form modal
```tsx
// src/pages/admin/MonsterForm.tsx
// Fields: name, sprite_id, type (select 6 types), hp, mp, str, agi, dex, int, luck, lore (textarea)
// "Generate Stats" button → calls generate_monster_stats command
// On generate: fills all numeric fields + lore, streamer can edit before saving
// Save → calls create_monster or update_monster
```

---

### Step 4: LLM generate stats command (Rust)
```rust
// src-tauri/src/commands/llm.rs
use reqwest::Client;
use serde_json::{json, Value};

#[tauri::command]
pub async fn generate_monster_stats(name: String, monster_type: String) -> Value {
    let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_default();
    let client = Client::new();

    let prompt = format!(
        "Generate stats for a monster named '{}' of type '{}' for a turn-based RPG battle game. \
        Return ONLY valid JSON with these exact keys: \
        hp (50-200), mp (30-120), str_stat (5-25), agi (5-25), dex (5-25), int_stat (5-25), luck (5-20), \
        abilities (array of 4 objects with: name, mp_cost, power, ability_type, effect), \
        passives (array of 4 objects with: name, effect), \
        lore (1 sentence flavor text). \
        No markdown, no explanation, only the JSON object.",
        name, monster_type
    );

    let body = json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1000,
        "messages": [{ "role": "user", "content": prompt }]
    });

    let res: Value = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send().await.unwrap()
        .json().await.unwrap();

    // Extract text content and parse as JSON
    let text = res["content"][0]["text"].as_str().unwrap_or("{}");
    serde_json::from_str(text).unwrap_or(json!({}))
}
```

---

### Step 5: Wire Generate Stats in React form
```tsx
// MonsterForm.tsx
const handleGenerate = async () => {
  setLoading(true)
  const stats = await invoke('generate_monster_stats', {
    name: form.name,
    monsterType: form.monster_type
  })
  setForm(prev => ({ ...prev, ...stats }))  // fills all fields
  setLoading(false)
}
```

---

### Step 6: Ability management per monster
```tsx
// src/pages/admin/AbilityManager.tsx
// Shown inside Monster edit view
// Two sections: Active (4 slots) + Passive (4 slots)
// Each slot: name, mp_cost, power, type, effect, status_inflict (select)
// Add/remove abilities from monster_abilities join table
```

---

### Step 7: Hunter form page
```tsx
// src/pages/admin/AdminHunters.tsx
// Same pattern as monsters
// Fields: name, sprite_id (file picker from /assets/sprites/hunters/), class, stats, lore
// No LLM generate for hunters — manually configured by streamer
```

---

### Step 8: Status effects page
```tsx
// src/pages/admin/AdminStatus.tsx
// Table: name, icon, effect_per_turn, duration, color swatch
// Add/Edit/Delete form
// Color input → previews as badge
```

---

### Step 9: Settings page
```tsx
// src/pages/admin/AdminSettings.tsx
// 4 input fields: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL_NAME, ANTHROPIC_API_KEY
// TWITCH_CLIENT_SECRET shown as password field
// "Save" → invoke('save_settings', { settings })
// "Copy OBS URL" button → copies "http://localhost:3000/overlay" to clipboard
```

---

### Step 10: Commit
```bash
git add .
git commit -m "feat: admin UI — CRUD for monsters, hunters, abilities, status effects, LLM generate"
```
