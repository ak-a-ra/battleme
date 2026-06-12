use rand::Rng;

use crate::battle::damage;
use crate::battle::status;
use crate::battle::types::{AbilityInput, BattleMon, BattleState, TurnResult};

/// Determine which side acts first based on AGI + small random tiebreaker.
/// Returns `("streamer", "chat")` or `("chat", "streamer")`.
pub fn resolve_turn_order(a: &BattleMon, b: &BattleMon) -> (&'static str, &'static str) {
    let a_speed = a.agi + rand::thread_rng().gen_range(0..3);
    let b_speed = b.agi + rand::thread_rng().gen_range(0..3);
    if a_speed >= b_speed {
        ("streamer", "chat")
    } else {
        ("chat", "streamer")
    }
}

/// Resolve one full turn: status ticks → turn order → two attacks → KO/winner check.
///
/// Mutates `state` in place. The caller is expected to hold a write lock on
/// the shared `Arc<RwLock<BattleState>>`.
pub fn resolve(
    state: &mut BattleState,
    streamer_move: &AbilityInput,
    chat_move: &AbilityInput,
) {
    state.turn_number += 1;

    // 1. Status tick on all monsters (both teams)
    for mon in &mut state.streamer_team {
        status::tick(mon);
    }
    for mon in &mut state.chat_team {
        status::tick(mon);
    }

    // 2. Find first-alive monster from each side
    let si = match state.streamer_team.iter().position(|m| !m.is_ko) {
        Some(i) => i,
        None => {
            check_winner(state);
            return;
        }
    };
    let ci = match state.chat_team.iter().position(|m| !m.is_ko) {
        Some(i) => i,
        None => {
            check_winner(state);
            return;
        }
    };

    // 3. Clone stats for damage computation (avoids borrow conflicts)
    let (s_stats, c_stats) = {
        let s = &state.streamer_team[si];
        let c = &state.chat_team[ci];
        (s.clone(), c.clone())
    };

    // 4. Determine turn order
    let (first_side, second_side) = resolve_turn_order(&s_stats, &c_stats);

    // 5. Compute both attacks (immutable, stateless)
    let first_attack = compute_attack(
        &s_stats, &c_stats,
        if first_side == "streamer" { streamer_move } else { chat_move },
        first_side,
    );
    let second_attack = if second_side == "streamer" {
        compute_attack(
            &s_stats, &c_stats,
            streamer_move,
            "streamer",
        )
    } else {
        compute_attack(
            &c_stats, &s_stats,
            chat_move,
            "chat",
        )
    };

    // 6. Apply first attack to live monsters
    if let Some(ref first_result) = first_attack {
        apply_damage(
            &mut state.streamer_team[si],
            &mut state.chat_team[ci],
            first_result,
            first_side,
        );
        state.turn_log.push(first_attack.unwrap());
    }

    // 7. Apply second attack (skip if either mon is now KO)
    if let Some(ref second_result) = second_attack {
        let still_alive = !state.streamer_team[si].is_ko && !state.chat_team[ci].is_ko;
        if still_alive {
            apply_damage(
                &mut state.streamer_team[si],
                &mut state.chat_team[ci],
                second_result,
                second_side,
            );
            state.turn_log.push(second_attack.unwrap());
        }
    }

    // 8. Check for winner
    check_winner(state);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Compute an attack's outcome (damage, crit, status) without mutating anything.
fn compute_attack(
    attacker_stats: &BattleMon,
    defender_stats: &BattleMon,
    ability: &AbilityInput,
    side: &str,
) -> Option<TurnResult> {
    let mult = crate::battle::types::type_multiplier(
        &attacker_stats.monster_type,
        &defender_stats.monster_type,
    );
    let dmg_result = damage::calculate(
        attacker_stats,
        defender_stats,
        ability.base_power,
        &ability.ability_type,
        mult,
    );

    let target_hp_after = (defender_stats.hp - dmg_result.damage).max(0);
    let target_ko = target_hp_after == 0;

    // 30% status infliction on successful hit
    let status_inflicted: Option<String> = if dmg_result.damage > 0 {
        ability
            .status_inflict_name
            .clone()
            .and_then(|name| {
                if rand::thread_rng().gen_bool(0.30) {
                    Some(name)
                } else {
                    None
                }
            })
    } else {
        None
    };

    let float_text = build_float_text(dmg_result.damage, dmg_result.is_crit, &status_inflicted);

    Some(TurnResult {
        attacker_side: side.to_string(),
        attacker_name: attacker_stats.name.clone(),
        ability_used: ability.name.clone(),
        damage_dealt: dmg_result.damage,
        is_crit: dmg_result.is_crit,
        status_inflicted: status_inflicted.clone(),
        target_hp_after,
        target_ko,
        float_text,
    })
}

/// Apply damage and status to the actual monsters.
fn apply_damage(
    streamer_mon: &mut BattleMon,
    chat_mon: &mut BattleMon,
    outcome: &TurnResult,
    attacker_side: &str,
) {
    // The target is always the opposite side from the attacker
    let target = if attacker_side == "streamer" {
        chat_mon
    } else {
        streamer_mon
    };

    target.hp = (target.hp - outcome.damage_dealt).max(0);
    if target.hp == 0 {
        target.is_ko = true;
    }

    // Apply status if one was inflicted
    if let Some(ref status_name) = outcome.status_inflicted {
        status::apply(target, status_name, 3);
    }
}

fn build_float_text(damage: i64, is_crit: bool, status: &Option<String>) -> String {
    if damage == 0 {
        return "MISS".to_string();
    }
    let mut text = if is_crit {
        format!("CRIT! {}", damage)
    } else {
        damage.to_string()
    };
    if let Some(s) = status {
        text.push_str(&format!(" [{}!]", s));
    }
    text
}

fn check_winner(state: &mut BattleState) {
    let streamer_alive = state.streamer_team.iter().any(|m| !m.is_ko);
    let chat_alive = state.chat_team.iter().any(|m| !m.is_ko);

    if !streamer_alive {
        state.winner = Some("chat".to_string());
    } else if !chat_alive {
        state.winner = Some("streamer".to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::battle::types::BattleMon;

    fn make_mon(agi: i64) -> BattleMon {
        BattleMon {
            id: 1,
            name: "Test".into(),
            monster_type: "Fire".into(),
            hp: 100,
            max_hp: 100,
            mp: 50,
            max_mp: 50,
            str_stat: 10,
            agi,
            dex: 10,
            int_stat: 10,
            luck: 10,
            active_status: None,
            is_ko: false,
        }
    }

    #[test]
    fn test_higher_agi_goes_first() {
        let fast = make_mon(99);
        let slow = make_mon(1);
        let fast_count: usize = (0..100)
            .map(|_| {
                let (first, _) = resolve_turn_order(&fast, &slow);
                first
            })
            .filter(|&r| r == "streamer")
            .count();
        assert!(
            fast_count > 50,
            "higher AGI (streamer=99) should go first more often, got {}",
            fast_count
        );
    }

    #[test]
    fn test_full_resolve_no_crash_and_deals_damage() {
        let mut state = BattleState::default();
        let mut s = make_mon(15);
        s.dex = 50; // high enough to hit reliably
        s.int_stat = 30;
        state.streamer_team.push(s);
        let mut c = make_mon(10);
        c.dex = 50;
        c.int_stat = 30;
        state.chat_team.push(c);

        let ability = AbilityInput {
            name: "Basic Attack".into(),
            base_power: 30,
            ability_type: "magic".into(), // magic always hits, avoids flaky misses
            status_inflict_name: None,
            status_duration: 0,
        };

        resolve(&mut state, &ability, &ability);

        assert_eq!(state.turn_number, 1);
        assert!(!state.turn_log.is_empty(), "should have at least one turn result");

        // At least one attack should have connected
        let total_damage_dealt: i64 = state.turn_log.iter().map(|t| t.damage_dealt).sum();
        assert!(total_damage_dealt > 0, "some damage should have been dealt");
    }

    #[test]
    fn test_ko_detects_winner() {
        let mut state = BattleState::default();
        // Chat monster very weak, streamer monster strong
        let mut weak = make_mon(10);
        weak.hp = 1;
        weak.max_hp = 1;
        state.chat_team.push(weak);
        let mut strong = make_mon(15);
        strong.int_stat = 99; // high INT for magic damage
        state.streamer_team.push(strong);

        let ability = AbilityInput {
            name: "Power Strike".into(),
            base_power: 200,
            ability_type: "magic".into(), // magic = always hits
            status_inflict_name: None,
            status_duration: 0,
        };

        resolve(&mut state, &ability, &ability);

        assert_eq!(
            state.winner.as_deref(),
            Some("streamer"),
            "streamer should win when chat mon dies"
        );
    }
}
