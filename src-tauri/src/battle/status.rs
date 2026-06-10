use crate::battle::types::{BattleMon, StatusState};

/// Apply status damage-over-time and decrement/expire the status.
/// Returns the amount of damage dealt (0 if no damage-over-time status).
pub fn tick(mon: &mut BattleMon) -> i64 {
    let status = match &mon.active_status {
        Some(s) => s.clone(),
        None => return 0,
    };

    let dmg = match status.name.as_str() {
        "Burn" => 5 + mon.max_hp / 20,               // flat + ~5% max HP
        "Poison" => {
            let base = mon.max_hp / 20;
            base + (base * status.intensity / 10)      // +10% per tick
        }
        "Bleeding" => mon.max_hp / 10,                 // 10% max HP
        _ => 0,                                         // Stun, Freeze, etc. no DoT
    };

    let turns_left = status.turns_left - 1;
    if turns_left <= 0 {
        mon.active_status = None;
    } else if let Some(ref mut s) = mon.active_status {
        s.turns_left = turns_left;
        if s.name == "Poison" {
            s.intensity += 1;
        }
    }

    if dmg > 0 {
        mon.hp = (mon.hp - dmg).max(0);
        if mon.hp == 0 {
            mon.is_ko = true;
        }
    }

    dmg
}

/// Apply a new status effect to a monster.
///
/// Rules:
/// - Freeze and Slow are mutually exclusive (replaces the other).
/// - Re-applying the same status resets its duration (no stacking).
pub fn apply(mon: &mut BattleMon, status_name: &str, duration: i64) {
    // Freeze <-> Slow mutual exclusion
    if let Some(ref current) = mon.active_status {
        let n = current.name.as_str();
        if (status_name == "Freeze" && n == "Slow")
            || (status_name == "Slow" && n == "Freeze")
        {
            mon.active_status = None;
        }
    }

    mon.active_status = Some(StatusState {
        name: status_name.to_string(),
        turns_left: duration,
        intensity: 0,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::types::BattleMon;

    fn make_mon(hp: i64, max_hp: i64, status: Option<StatusState>) -> BattleMon {
        BattleMon {
            id: 1,
            name: "Test".into(),
            monster_type: "Fire".into(),
            hp,
            max_hp,
            mp: 50,
            max_mp: 50,
            str_stat: 10,
            agi: 10,
            dex: 10,
            int_stat: 10,
            luck: 10,
            active_status: status,
            is_ko: false,
        }
    }

    #[test]
    fn test_burn_deals_damage_and_decrements() {
        let mut mon = make_mon(
            100,
            100,
            Some(StatusState {
                name: "Burn".into(),
                turns_left: 3,
                intensity: 0,
            }),
        );
        let dmg = tick(&mut mon);
        assert!(dmg > 0, "burn should deal damage");
        assert_eq!(
            mon.active_status.as_ref().unwrap().turns_left,
            2,
            "turns should decrement"
        );
    }

    #[test]
    fn test_status_expires_at_zero_turns() {
        let mut mon = make_mon(
            100,
            100,
            Some(StatusState {
                name: "Stun".into(),
                turns_left: 1,
                intensity: 0,
            }),
        );
        tick(&mut mon);
        assert!(
            mon.active_status.is_none(),
            "status should expire when turns_left reaches 0"
        );
    }

    #[test]
    fn test_poison_intensifies() {
        let mut mon = make_mon(
            200,
            200,
            Some(StatusState {
                name: "Poison".into(),
                turns_left: 4,
                intensity: 0,
            }),
        );
        tick(&mut mon);
        assert_eq!(
            mon.active_status.as_ref().unwrap().intensity,
            1,
            "poison intensity should increment"
        );
    }

    #[test]
    fn test_freeze_replaces_slow() {
        let mut mon = make_mon(
            100,
            100,
            Some(StatusState {
                name: "Slow".into(),
                turns_left: 3,
                intensity: 0,
            }),
        );
        apply(&mut mon, "Freeze", 2);
        assert_eq!(
            mon.active_status.as_ref().unwrap().name,
            "Freeze",
            "Freeze should replace Slow"
        );
        assert_eq!(mon.active_status.as_ref().unwrap().turns_left, 2);
    }

    #[test]
    fn test_reapply_resets_duration() {
        let mut mon = make_mon(
            100,
            100,
            Some(StatusState {
                name: "Burn".into(),
                turns_left: 1,
                intensity: 0,
            }),
        );
        apply(&mut mon, "Burn", 3);
        assert_eq!(
            mon.active_status.as_ref().unwrap().turns_left,
            3,
            "re-applying burn should reset duration to 3"
        );
    }
}
