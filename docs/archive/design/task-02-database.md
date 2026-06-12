# Task 02: Database Schema & Seed

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Define SQLite schema for all entities and seed 12 default monsters on first launch.

**Architecture:** Rust manages SQLite via `rusqlite`. Schema runs as migrations on app start. Seed data is hardcoded in Rust and inserted if DB is empty.

**Tech Stack:** rusqlite, Tauri v2

---

### Step 1: Add rusqlite dependency
```toml
# src-tauri/Cargo.toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

---

### Step 2: Create db module
```
src-tauri/src/db/
  mod.rs
  migrations.rs
  seed.rs
  models.rs
```

---

### Step 3: Write models
```rust
// src-tauri/src/db/models.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Monster {
    pub id: i64,
    pub name: String,
    pub sprite_id: String,
    pub monster_type: String, // Fire/Water/Earth/Wind/Dark/Light
    pub hp: i64,
    pub mp: i64,
    pub str_stat: i64,
    pub agi: i64,
    pub dex: i64,
    pub int_stat: i64,
    pub luck: i64,
    pub lore: String,
    pub generated_by_llm: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Hunter {
    pub id: i64,
    pub name: String,
    pub sprite_id: String,
    pub class: String,
    pub hp: i64,
    pub mp: i64,
    pub str_stat: i64,
    pub agi: i64,
    pub dex: i64,
    pub int_stat: i64,
    pub luck: i64,
    pub lore: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Ability {
    pub id: i64,
    pub name: String,
    pub mp_cost: i64,
    pub power: i64,
    pub ability_type: String, // physical/magic
    pub effect: String,
    pub status_inflict_id: Option<i64>,
    pub is_passive: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusEffect {
    pub id: i64,
    pub name: String,       // Burn/Poison/Freeze etc
    pub icon: String,       // emoji or asset path
    pub effect_per_turn: String,
    pub duration: i64,
    pub visual_color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BattleLog {
    pub id: i64,
    pub date: String,
    pub winner_side: String, // "streamer" | "chat"
    pub streamer_team: String, // JSON array of monster ids
    pub chat_team: String,
    pub turns: String,       // JSON array of turn data
    pub duration_secs: i64,
}
```

---

### Step 4: Write migrations
```rust
// src-tauri/src/db/migrations.rs
use rusqlite::Connection;

pub fn run(conn: &Connection) {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS monsters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sprite_id TEXT NOT NULL,
            monster_type TEXT NOT NULL,
            hp INTEGER NOT NULL,
            mp INTEGER NOT NULL,
            str_stat INTEGER NOT NULL,
            agi INTEGER NOT NULL,
            dex INTEGER NOT NULL,
            int_stat INTEGER NOT NULL,
            luck INTEGER NOT NULL,
            lore TEXT DEFAULT '',
            generated_by_llm INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS hunters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sprite_id TEXT NOT NULL,
            class TEXT NOT NULL,
            hp INTEGER NOT NULL,
            mp INTEGER NOT NULL,
            str_stat INTEGER NOT NULL,
            agi INTEGER NOT NULL,
            dex INTEGER NOT NULL,
            int_stat INTEGER NOT NULL,
            luck INTEGER NOT NULL,
            lore TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS abilities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mp_cost INTEGER NOT NULL DEFAULT 0,
            power INTEGER NOT NULL DEFAULT 0,
            ability_type TEXT NOT NULL,
            effect TEXT DEFAULT '',
            status_inflict_id INTEGER REFERENCES status_effects(id),
            is_passive INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS monster_abilities (
            monster_id INTEGER REFERENCES monsters(id),
            ability_id INTEGER REFERENCES abilities(id),
            PRIMARY KEY (monster_id, ability_id)
        );

        CREATE TABLE IF NOT EXISTS hunter_abilities (
            hunter_id INTEGER REFERENCES hunters(id),
            ability_id INTEGER REFERENCES abilities(id),
            PRIMARY KEY (hunter_id, ability_id)
        );

        CREATE TABLE IF NOT EXISTS status_effects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            icon TEXT NOT NULL,
            effect_per_turn TEXT DEFAULT '',
            duration INTEGER NOT NULL DEFAULT 3,
            visual_color TEXT DEFAULT '#ffffff'
        );

        CREATE TABLE IF NOT EXISTS battle_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            winner_side TEXT NOT NULL,
            streamer_team TEXT NOT NULL,
            chat_team TEXT NOT NULL,
            turns TEXT NOT NULL DEFAULT '[]',
            duration_secs INTEGER DEFAULT 0
        );
    ").unwrap();
}
```

---

### Step 5: Write seed data (12 monsters, 9 status effects)
```rust
// src-tauri/src/db/seed.rs
use rusqlite::Connection;

pub fn run_if_empty(conn: &Connection) {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM monsters", [], |r| r.get(0))
        .unwrap_or(0);
    if count > 0 { return; }

    seed_status_effects(conn);
    seed_monsters(conn);
    seed_default_hunter(conn);
}

fn seed_status_effects(conn: &Connection) {
    let effects = vec![
        ("Burn",     "🔥", "Flat fire damage per turn",               3, "#ff4400"),
        ("Poison",   "☠️",  "DoT that intensifies each turn +10%",     4, "#44ff00"),
        ("Freeze",   "❄️",  "Reduces AGI and dodge chance",            3, "#00aaff"),
        ("Stun",     "⚡",  "Skip turn entirely",                      1, "#ffff00"),
        ("Blind",    "👁️",  "Reduces physical accuracy",               3, "#888888"),
        ("Slow",     "🐌",  "Reduces AGI",                             3, "#996633"),
        ("Fear",     "😱",  "Monster can only use basic attack",       3, "#aa00ff"),
        ("Bleeding", "🩸",  "DoT as % of max HP per turn",             3, "#cc0000"),
        ("Sleep",    "💤",  "Skip multiple turns, breaks on damage",   3, "#6666ff"),
    ];
    for (name, icon, effect, duration, color) in effects {
        conn.execute(
            "INSERT OR IGNORE INTO status_effects (name, icon, effect_per_turn, duration, visual_color)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (name, icon, effect, duration, color),
        ).unwrap();
    }
}

fn seed_monsters(conn: &Connection) {
    // 2 monsters per type (Fire, Water, Earth, Wind, Dark, Light)
    let monsters = vec![
        ("Emberwolf",  "emberwolf",  "Fire",  120, 60,  18, 14, 12, 10, 8),
        ("Flamecrow",  "flamecrow",  "Fire",  100, 80,  14, 16, 15, 14, 10),
        ("Tidalfin",   "tidalfin",   "Water", 130, 70,  15, 12, 13, 16, 9),
        ("Stormray",   "stormray",   "Water", 110, 90,  12, 14, 14, 18, 11),
        ("Stoneback",  "stoneback",  "Earth", 160, 40,  20, 8,  10, 8,  7),
        ("Mudcrawler", "mudcrawler", "Earth", 140, 50,  16, 10, 12, 10, 9),
        ("Galebird",   "galebird",   "Wind",  90,  70,  13, 20, 17, 12, 12),
        ("Driftfang",  "driftfang",  "Wind",  100, 60,  15, 18, 16, 10, 10),
        ("Voidshade",  "voidshade",  "Dark",  115, 85,  16, 15, 13, 18, 13),
        ("Grimspawn",  "grimspawn",  "Dark",  125, 75,  19, 13, 11, 14, 11),
        ("Dawnwing",   "dawnwing",   "Light", 120, 80,  14, 16, 15, 16, 14),
        ("Solarclaw",  "solarclaw",  "Light", 110, 90,  13, 15, 16, 18, 15),
    ];
    for (name, sprite, mtype, hp, mp, str, agi, dex, int, luck) in monsters {
        conn.execute(
            "INSERT INTO monsters (name, sprite_id, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            (name, sprite, mtype, hp, mp, str, agi, dex, int, luck),
        ).unwrap();
    }
}

fn seed_default_hunter(conn: &Connection) {
    conn.execute(
        "INSERT OR IGNORE INTO hunters (name, sprite_id, class, hp, mp, str_stat, agi, dex, int_stat, luck)
         VALUES ('Hunter', 'hunter_default', 'Fighter', 200, 100, 15, 15, 15, 15, 10)",
        [],
    ).unwrap();
}
```

---

### Step 6: Wire up DB init in main
```rust
// src-tauri/src/main.rs
mod db;

fn main() {
    let conn = rusqlite::Connection::open("battleme.db").unwrap();
    // ^ Dev fallback — in production use app.path().app_data_dir() instead.
    db::migrations::run(&conn);
    db::seed::run_if_empty(&conn);

    tauri::Builder::default()
        .run(tauri::generate_context!())
        .unwrap();
}
```

---

### Step 7: Commit
```bash
git add .
git commit -m "feat: db schema, migrations, seed data"
```
