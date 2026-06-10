use rand::Rng;
use crate::battle::types::BattleMon;

/// Result of a single damage calculation.
pub struct DamageResult {
    pub damage: i64,
    pub is_crit: bool,
}

/// Calculate damage from an attacker to a defender.
///
/// * `ability_type` — "physical" or "magic" (determines base stat)
/// * `type_multiplier` — from `types::type_multiplier()`
pub fn calculate(
    attacker: &BattleMon,
    defender: &BattleMon,
    base_power: i64,
    ability_type: &str,
    type_multiplier: f64,
) -> DamageResult {
    let mut rng = rand::thread_rng();

    // Base stat: INT for magic, STR for physical
    let base_stat = if ability_type == "magic" {
        attacker.int_stat
    } else {
        attacker.str_stat
    };

    // Variance 80%–120%
    let variance: f64 = rng.gen_range(0.80..=1.20);

    // Crit check: DEX / 200.0 (cap at 0.95)
    let crit_chance = (attacker.dex as f64 / 200.0).min(0.95);
    let is_crit = rng.gen_bool(crit_chance);

    // Crit multiplier: 1.5 base + LUCK scaling
    let crit_mult = if is_crit {
        1.5 + (attacker.luck as f64 * 0.005)
    } else {
        1.0
    };

    // Physical miss check (DEX accuracy)
    let hit_chance = if ability_type == "physical" {
        (attacker.dex as f64 / 100.0).min(0.99)
    } else {
        1.0 // magic always hits
    };
    if !rng.gen_bool(hit_chance) {
        return DamageResult {
            damage: 0,
            is_crit: false,
        };
    }

    // Dodge check (defender AGI)
    let dodge_chance = (defender.agi as f64 / 300.0).min(0.40);
    if rng.gen_bool(dodge_chance) {
        return DamageResult {
            damage: 0,
            is_crit: false,
        };
    }

    let raw =
        (base_power as f64 + base_stat as f64) * variance * crit_mult * type_multiplier;

    DamageResult {
        damage: raw.round() as i64,
        is_crit,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::types::BattleMon;

    fn make_mon(dex: i64, agi: i64, str_stat: i64, int_stat: i64, luck: i64) -> BattleMon {
        BattleMon {
            id: 1,
            name: "Test".into(),
            monster_type: "Fire".into(),
            hp: 100,
            max_hp: 100,
            mp: 50,
            max_mp: 50,
            str_stat,
            agi,
            dex,
            int_stat,
            luck,
            active_status: None,
            is_ko: false,
        }
    }

    #[test]
    fn test_damage_in_expected_range() {
        let atk = make_mon(20, 10, 15, 10, 10);
        let def = make_mon(10, 10, 10, 10, 10);
        let mut found_normal = false;
        for _ in 0..100 {
            let result = calculate(&atk, &def, 50, "physical", 1.0);
            if !result.is_crit && result.damage > 0 {
                // raw = (50 + 15) * (0.8..1.2) * 1.0 * 1.0 = 52..78
                assert!(
                    result.damage >= 26 && result.damage <= 78,
                    "damage {} out of expected range [26, 78]",
                    result.damage
                );
                found_normal = true;
                break;
            }
        }
        assert!(found_normal, "never got a non-crit hit in 100 iterations");
    }

    #[test]
    fn test_low_dex_produces_misses() {
        let atk = make_mon(1, 10, 15, 10, 10); // dex=1 → 1% hit chance
        let def = make_mon(10, 1, 10, 10, 10);
        let mut found_miss = false;
        for _ in 0..200 {
            let result = calculate(&atk, &def, 50, "physical", 1.0);
            if result.damage == 0 {
                found_miss = true;
                break;
            }
        }
        assert!(found_miss, "expected at least one miss with dex=1 over 200 tries");
    }

    #[test]
    fn test_magic_always_hits_low_dex() {
        let atk = make_mon(1, 10, 10, 15, 10); // dex=1 but magic
        let def = make_mon(10, 300, 10, 10, 10); // high dodge
        let mut found_hit = false;
        for _ in 0..50 {
            let result = calculate(&atk, &def, 50, "magic", 1.0);
            if result.damage > 0 {
                found_hit = true;
                break;
            }
        }
        assert!(found_hit, "magic should hit despite low dex");
    }
}
