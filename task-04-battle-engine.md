# Task 04: Battle Engine (Rust)

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Implement core turn-based battle logic in Rust — damage calc, type chart, status effects, AGI turn order.

**Architecture:** Pure Rust module with no Tauri dependency. All battle state lives in a `BattleState` struct. Commands call engine functions and return serializable results to React.

**Tech Stack:** Rust, rand crate, serde

---

### Step 1: Add rand dependency
```toml
# src-tauri/Cargo.toml
[dependencies]
rand = "0.8"
```

---

### Step 2: Create battle module structure
```
src-tauri/src/battle/
  mod.rs
  engine.rs
  types.rs
  status.rs
  damage.rs
```

---

### Step 3: Define BattleState and turn types
```rust
// src-tauri/src/battle/types.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BattleMon {
    pub id: i64,
    pub name: String,
    pub monster_type: String,
    pub hp: i64,
    pub max_hp: i64,
    pub mp: i64,
    pub max_mp: i64,
    pub str_stat: i64,
    pub agi: i64,
    pub dex: i64,
    pub int_stat: i64,
    pub luck: i64,
    pub active_status: Option<StatusState>,
    pub is_ko: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusState {
    pub name: String,         // "Burn", "Poison", etc
    pub turns_left: i64,
    pub intensity: i64,       // for Poison stacking
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnResult {
    pub attacker_side: String,    // "streamer" | "chat"
    pub attacker_name: String,
    pub ability_used: String,
    pub damage_dealt: i64,
    pub is_crit: bool,
    pub status_inflicted: Option<String>,
    pub target_hp_after: i64,
    pub target_ko: bool,
    pub float_text: String,       // shown on overlay
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BattleState {
    pub streamer_team: Vec<BattleMon>,
    pub chat_team: Vec<BattleMon>,
    pub turn_number: i64,
    pub winner: Option<String>,   // "streamer" | "chat" | None
    pub turn_log: Vec<TurnResult>,
}
```

---

### Step 4: Type effectiveness chart
```rust
// src-tauri/src/battle/types.rs (append)
pub fn type_multiplier(attacker_type: &str, defender_type: &str) -> f64 {
    match (attacker_type, defender_type) {
        ("Fire",  "Earth") | ("Fire",  "Wind")  => 1.5,
        ("Water", "Fire")  | ("Water", "Earth") => 1.5,
        ("Earth", "Water")                       => 1.5,
        ("Wind",  "Water") | ("Wind",  "Earth") => 1.5,
        ("Dark",  "Light") | ("Light", "Dark")  => 1.5,
        ("Fire",  "Water")                       => 0.5,
        ("Water", "Wind")                        => 0.5,
        ("Earth", "Fire")  | ("Earth", "Wind")  => 0.5,
        ("Wind",  "Fire")                        => 0.5,
        ("Dark",  "Dark")  | ("Light", "Light") => 0.5,
        _ => 1.0, // neutral
    }
}
```

---

### Step 5: Damage calculation
```rust
// src-tauri/src/battle/damage.rs
use rand::Rng;
use crate::battle::types::BattleMon;

pub struct DamageResult {
    pub damage: i64,
    pub is_crit: bool,
}

pub fn calculate(
    attacker: &BattleMon,
    defender: &BattleMon,
    base_power: i64,
    ability_type: &str,  // "physical" | "magic"
    type_multiplier: f64,
) -> DamageResult {
    let mut rng = rand::thread_rng();

    // Base stat
    let base_stat = if ability_type == "magic" {
        attacker.int_stat
    } else {
        attacker.str_stat
    };

    // Variance 80%-120%
    let variance: f64 = rng.gen_range(0.80..=1.20);

    // Crit check: DEX / 200.0 = base crit chance
    let crit_chance = attacker.dex as f64 / 200.0;
    let is_crit = rng.gen_bool(crit_chance.min(0.95));

    // LUCK scales crit multiplier: 1.5 base + 0.005 per LUCK
    let crit_mult = if is_crit {
        1.5 + (attacker.luck as f64 * 0.005)
    } else {
        1.0
    };

    // Miss check for physical (DEX-based accuracy)
    let hit_chance = if ability_type == "physical" {
        (attacker.dex as f64 / 100.0).min(0.99)
    } else {
        1.0 // magic always hits
    };
    if !rng.gen_bool(hit_chance) {
        return DamageResult { damage: 0, is_crit: false };
    }

    // Dodge check (AGI-based)
    let dodge_chance = (defender.agi as f64 / 300.0).min(0.40);
    if rng.gen_bool(dodge_chance) {
        return DamageResult { damage: 0, is_crit: false };
    }

    let raw = (base_power as f64 + base_stat as f64) * variance * crit_mult * type_multiplier;
    DamageResult {
        damage: raw.round() as i64,
        is_crit,
    }
}
```

---

### Step 6: Status effect tick logic
```rust
// src-tauri/src/battle/status.rs
use crate::battle::types::{BattleMon, StatusState};

// Returns damage dealt by status this turn
pub fn tick(mon: &mut BattleMon) -> i64 {
    let status = match &mon.active_status {
        Some(s) => s.clone(),
        None => return 0,
    };

    let dmg = match status.name.as_str() {
        "Burn"     => 5 + mon.max_hp / 20,          // flat ~5% max HP
        "Poison"   => {
            let base = mon.max_hp / 20;
            base + (base * status.intensity / 10)    // +10% per tick
        },
        "Bleeding" => mon.max_hp / 10,               // 10% max HP
        _ => 0,
    };

    // Decrement turns
    let turns_left = status.turns_left - 1;
    if turns_left <= 0 {
        mon.active_status = None;
    } else {
        if let Some(ref mut s) = mon.active_status {
            s.turns_left = turns_left;
            if s.name == "Poison" { s.intensity += 1; }
        }
    }

    mon.hp = (mon.hp - dmg).max(0);
    if mon.hp == 0 { mon.is_ko = true; }
    dmg
}

pub fn apply(mon: &mut BattleMon, status_name: &str, duration: i64) {
    // Mutually exclusive: Freeze/Slow replace each other
    if (status_name == "Freeze" && mon.active_status.as_ref().map(|s| s.name == "Slow").unwrap_or(false))
    || (status_name == "Slow"   && mon.active_status.as_ref().map(|s| s.name == "Freeze").unwrap_or(false)) {
        mon.active_status = None;
    }
    // Re-apply = reset duration
    mon.active_status = Some(StatusState {
        name: status_name.to_string(),
        turns_left: duration,
        intensity: 0,
    });
}
```

---

### Step 7: Turn order resolver
```rust
// src-tauri/src/battle/engine.rs
use rand::Rng;
use crate::battle::types::BattleMon;

pub fn resolve_turn_order(a: &BattleMon, b: &BattleMon) -> (&'static str, &'static str) {
    // AGI tie = random
    let a_speed = a.agi + rand::thread_rng().gen_range(0..3);
    let b_speed = b.agi + rand::thread_rng().gen_range(0..3);
    if a_speed >= b_speed { ("streamer", "chat") } else { ("chat", "streamer") }
}
```

---

### Step 8: Expose battle commands to Tauri
```rust
// src-tauri/src/commands/battle.rs
#[tauri::command]
pub fn resolve_turn(
    state: State<AppState>,
    battle_state: BattleState,
    streamer_move: AbilityInput,
    chat_move: AbilityInput,
) -> BattleState {
    // call engine functions, return updated state
    battle::engine::resolve(battle_state, streamer_move, chat_move)
}
```

---

### Step 9: Commit
```bash
git add .
git commit -m "feat: battle engine — damage calc, type chart, status effects, turn order"
```
