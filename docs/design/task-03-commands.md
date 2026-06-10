# Task 03: Tauri Commands (Backend API)

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Expose all DB operations and battle logic to React via Tauri invoke commands.

**Architecture:** Each command is a Rust function tagged `#[tauri::command]`. React calls them via `invoke('command_name', args)`. State is passed via AppState using a `tokio::sync::Mutex`-wrapped DB connection (not `std::sync::Mutex` — needed for async safety across `.await` points). A shared `Arc<RwLock<BattleState>>` is also passed for the HTTP bridge.

**Tech Stack:** Tauri v2, tokio, rusqlite, serde_json

---

### Step 1: Set up AppState with DB connection
```rust
// src-tauri/src/main.rs
use tokio::sync::Mutex;   // tokio::sync::Mutex for async safety
use std::sync::{Arc, RwLock};
use rusqlite::Connection;
use crate::battle::types::BattleState;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub battle_state: Arc<RwLock<BattleState>>,
}
```

---

### Step 2: Create commands module structure
```
src-tauri/src/commands/
  mod.rs
  monsters.rs
  hunters.rs
  abilities.rs
  status_effects.rs
  battle.rs
  settings.rs
```

---

### Step 3: Monster CRUD commands
```rust
// src-tauri/src/commands/monsters.rs
use crate::AppState;
use crate::db::models::Monster;
use tauri::State;

#[tauri::command]
pub fn get_monsters(state: State<AppState>) -> Vec<Monster> {
    let db = state.db.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT id,name,sprite_id,monster_type,hp,mp,str_stat,agi,dex,int_stat,luck,lore,generated_by_llm FROM monsters"
    ).unwrap();
    stmt.query_map([], |row| Ok(Monster {
        id: row.get(0)?,
        name: row.get(1)?,
        sprite_id: row.get(2)?,
        monster_type: row.get(3)?,
        hp: row.get(4)?,
        mp: row.get(5)?,
        str_stat: row.get(6)?,
        agi: row.get(7)?,
        dex: row.get(8)?,
        int_stat: row.get(9)?,
        luck: row.get(10)?,
        lore: row.get(11)?,
        generated_by_llm: row.get::<_,i64>(12)? == 1,
    })).unwrap().filter_map(|r| r.ok()).collect()
}

#[tauri::command]
pub fn create_monster(state: State<AppState>, monster: Monster) -> i64 {
    let db = state.db.lock().unwrap();
    db.execute(
        "INSERT INTO monsters (name,sprite_id,monster_type,hp,mp,str_stat,agi,dex,int_stat,luck,lore,generated_by_llm)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        (&monster.name,&monster.sprite_id,&monster.monster_type,
         monster.hp,monster.mp,monster.str_stat,monster.agi,
         monster.dex,monster.int_stat,monster.luck,&monster.lore,
         monster.generated_by_llm as i64),
    ).unwrap();
    db.last_insert_rowid()
}

#[tauri::command]
pub fn update_monster(state: State<AppState>, monster: Monster) {
    let db = state.db.lock().unwrap();
    db.execute(
        "UPDATE monsters SET name=?1,sprite_id=?2,monster_type=?3,hp=?4,mp=?5,
         str_stat=?6,agi=?7,dex=?8,int_stat=?9,luck=?10,lore=?11 WHERE id=?12",
        (&monster.name,&monster.sprite_id,&monster.monster_type,
         monster.hp,monster.mp,monster.str_stat,monster.agi,
         monster.dex,monster.int_stat,monster.luck,&monster.lore,monster.id),
    ).unwrap();
}

#[tauri::command]
pub fn delete_monster(state: State<AppState>, id: i64) {
    let db = state.db.lock().unwrap();
    db.execute("DELETE FROM monsters WHERE id=?1", [id]).unwrap();
}
```

---

### Step 4: Ability CRUD commands
Same pattern as monsters in `src-tauri/src/commands/abilities.rs`:
- `get_abilities_for_monster(monster_id)`
- `create_ability(ability)`
- `update_ability(ability)`
- `delete_ability(id)`
- `assign_ability_to_monster(monster_id, ability_id)`

---

### Step 5: Hunter commands
Same pattern in `src-tauri/src/commands/hunters.rs`:
- `get_hunters()`
- `create_hunter(hunter)`
- `update_hunter(hunter)`
- `delete_hunter(id)`

---

### Step 6: Status effect commands
In `src-tauri/src/commands/status_effects.rs`:
- `get_status_effects()`
- `create_status_effect(effect)`
- `update_status_effect(effect)`
- `delete_status_effect(id)`

---

### Step 7: Settings commands
```rust
// src-tauri/src/commands/settings.rs
use std::collections::HashMap;

#[tauri::command]
pub fn get_settings() -> HashMap<String, String> {
    dotenvy::dotenv().ok();
    let mut map = HashMap::new();
    for key in ["TWITCH_CLIENT_ID","TWITCH_CHANNEL_NAME","ANTHROPIC_API_KEY"] {
        map.insert(key.to_string(), std::env::var(key).unwrap_or_default());
    }
    map
}

#[tauri::command]
pub fn save_settings(settings: HashMap<String, String>) {
    // Write key=value lines to .env file
    let content: String = settings.iter()
        .map(|(k, v)| format!("{}={}\n", k, v))
        .collect();
    std::fs::write(".env", content).unwrap();
}
```
Add `dotenvy = "0.15"` to `Cargo.toml`.

---

### Step 8: Register all commands in main
```rust
tauri::Builder::default()
    .manage(AppState { db: Mutex::new(conn) })
    .invoke_handler(tauri::generate_handler![
        commands::monsters::get_monsters,
        commands::monsters::create_monster,
        commands::monsters::update_monster,
        commands::monsters::delete_monster,
        commands::hunters::get_hunters,
        commands::hunters::create_hunter,
        commands::hunters::update_hunter,
        commands::hunters::delete_hunter,
        commands::abilities::get_abilities_for_monster,
        commands::abilities::create_ability,
        commands::abilities::update_ability,
        commands::abilities::delete_ability,
        commands::abilities::assign_ability_to_monster,
        commands::status_effects::get_status_effects,
        commands::status_effects::create_status_effect,
        commands::status_effects::update_status_effect,
        commands::status_effects::delete_status_effect,
        commands::settings::get_settings,
        commands::settings::save_settings,
    ])
    .run(tauri::generate_context!())
    .unwrap();
```

Note: In async commands, acquire the Mutex with `.lock().await` instead of `.lock().unwrap()`.

> **Important:** Do NOT hold the Mutex across `.await` points. Access DB in short sync blocks, release, then await.

---

### Step 9: Create React invoke hooks
```ts
// src/lib/invoke.ts
import { invoke } from '@tauri-apps/api/core'

export const api = {
  getMonsters: () => invoke('get_monsters'),
  createMonster: (m: any) => invoke('create_monster', { monster: m }),
  updateMonster: (m: any) => invoke('update_monster', { monster: m }),
  deleteMonster: (id: number) => invoke('delete_monster', { id }),
  getHunters: () => invoke('get_hunters'),
  getStatusEffects: () => invoke('get_status_effects'),
  getSettings: () => invoke('get_settings'),
  saveSettings: (s: any) => invoke('save_settings', { settings: s }),
}
```

---

### Step 10: Commit
```bash
git add .
git commit -m "feat: tauri commands for all CRUD operations"
```
