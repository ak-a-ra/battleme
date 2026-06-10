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
    pub name: String,
    pub icon: String,
    pub effect_per_turn: String,
    pub duration: i64,
    pub visual_color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BattleLog {
    pub id: i64,
    pub date: String,
    pub winner_side: String, // "streamer" | "chat"
    pub streamer_team: String,
    pub chat_team: String,
    pub turns: String,
    pub duration_secs: i64,
}
