use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// BattleMon — a monster in battle (owned by the engine)
// ---------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BattleMon {
    pub id: i64,
    pub name: String,
    pub monster_type: String, // Fire / Water / Earth / Wind / Dark / Light
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

// ---------------------------------------------------------------------------
// StatusState — an active status effect on a BattleMon
// ---------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusState {
    pub name: String,         // "Burn", "Poison", etc
    pub turns_left: i64,
    pub intensity: i64,       // Poison stacking
}

// ---------------------------------------------------------------------------
// TurnResult — one attack resolution, pushed to BattleState.turn_log
// ---------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnResult {
    pub attacker_side: String,   // "streamer" | "chat"
    pub attacker_name: String,
    pub ability_used: String,
    pub damage_dealt: i64,
    pub is_crit: bool,
    pub status_inflicted: Option<String>,
    pub target_hp_after: i64,
    pub target_ko: bool,
    pub float_text: String,      // shown on overlay
}

// ---------------------------------------------------------------------------
// AbilityInput — lightweight move info from the caller (no DB refs)
// ---------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbilityInput {
    pub name: String,
    pub base_power: i64,
    pub ability_type: String,             // "physical" | "magic"
    pub status_inflict_name: Option<String>,
    pub status_duration: i64,
}

// ---------------------------------------------------------------------------
// BattleState — full mutable state of a battle, shared via Arc<RwLock<>>
// ---------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BattleState {
    pub streamer_team: Vec<BattleMon>,
    pub chat_team: Vec<BattleMon>,
    pub turn_number: i64,
    pub winner: Option<String>,            // "streamer" | "chat" | None
    pub turn_log: Vec<TurnResult>,
    #[serde(default)]
    pub phase: String,                     // "idle" | "draft" | "battle" | "complete"
    #[serde(default)]
    pub poll_duration_secs: i64,           // 0 = no active poll
    #[serde(default)]
    pub poll_started_at_ms: i64,           // unix ms timestamp, 0 = no active poll
    #[serde(default)]
    pub started_at_ms: i64,                // unix ms when battle started, 0 = not started
}

// ---------------------------------------------------------------------------
// Type chart — 6-element type effectiveness
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_type_multiplier_fire_vs_earth() {
        assert!((type_multiplier("Fire", "Earth") - 1.5).abs() < 1e-9);
    }

    #[test]
    fn test_type_multiplier_fire_vs_water() {
        assert!((type_multiplier("Fire", "Water") - 0.5).abs() < 1e-9);
    }

    #[test]
    fn test_type_multiplier_fire_vs_light() {
        assert!((type_multiplier("Fire", "Light") - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_type_multiplier_dark_vs_dark() {
        assert!((type_multiplier("Dark", "Dark") - 0.5).abs() < 1e-9);
    }

    #[test]
    fn test_battle_state_default() {
        let bs = BattleState::default();
        assert_eq!(bs.turn_number, 0);
        assert!(bs.winner.is_none());
        assert!(bs.turn_log.is_empty());
        assert_eq!(bs.poll_duration_secs, 0);
        assert_eq!(bs.poll_started_at_ms, 0);
        assert_eq!(bs.started_at_ms, 0);
    }
}
