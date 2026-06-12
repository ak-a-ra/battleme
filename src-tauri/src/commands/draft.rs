use crate::battle::types::{BattleMon, BattleState};
use crate::db::models::{Hunter, Monster};
use crate::AppState;
use serde::Serialize;
use tauri::State;

/// Returned by `get_streamer_lineup`.
#[derive(Serialize)]
pub struct StreamerLineup {
    pub hunter: Hunter,
    pub monsters: Vec<Monster>, // exactly 3
}

/// Save (or replace) the streamer's pre-battle lineup.
///
/// Expects exactly 3 monster IDs.
#[tauri::command]
pub async fn save_streamer_lineup(
    state: State<'_, AppState>,
    hunter_id: i64,
    monster_ids: Vec<i64>,
) -> Result<(), String> {
    if monster_ids.len() != 3 {
        return Err("Need exactly 3 monsters for the lineup".into());
    }

    let db = state.db.lock().await;
    db.execute(
        "INSERT OR REPLACE INTO streamer_lineup (id, hunter_id, slot1_monster_id, slot2_monster_id, slot3_monster_id)
         VALUES (1, ?1, ?2, ?3, ?4)",
        rusqlite::params![hunter_id, monster_ids[0], monster_ids[1], monster_ids[2]],
    )
    .map_err(|e| format!("DB error: {e}"))?;

    Ok(())
}

/// Load the current streamer lineup (hunter + 3 monsters).
/// Returns `None` if no lineup has been saved yet.
#[tauri::command]
pub async fn get_streamer_lineup(
    state: State<'_, AppState>,
) -> Result<Option<StreamerLineup>, String> {
    let db = state.db.lock().await;

    // Check if a lineup exists
    let (hunter_id, m1, m2, m3): (i64, i64, i64, i64) = match db.query_row(
        "SELECT hunter_id, slot1_monster_id, slot2_monster_id, slot3_monster_id FROM streamer_lineup WHERE id=1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    ) {
        Ok(row) => row,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(format!("DB error: {e}")),
    };

    // Load hunter
    let hunter: Hunter = db
        .query_row(
            "SELECT id, name, sprite_id, class, hp, mp, str_stat, agi, dex, int_stat, luck, lore FROM hunters WHERE id=?1",
            [hunter_id],
            |row| {
                Ok(Hunter {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sprite_id: row.get(2)?,
                    class: row.get(3)?,
                    hp: row.get(4)?,
                    mp: row.get(5)?,
                    str_stat: row.get(6)?,
                    agi: row.get(7)?,
                    dex: row.get(8)?,
                    int_stat: row.get(9)?,
                    luck: row.get(10)?,
                    lore: row.get(11)?,
                })
            },
        )
        .map_err(|e| format!("Hunter query failed: {e}"))?;

    // Load 3 monsters
    let monster_ids = [m1, m2, m3];
    let mut monsters = Vec::with_capacity(3);
    for mid in &monster_ids {
        let mon: Monster = db
            .query_row(
                "SELECT id, name, sprite_id, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck, lore, generated_by_llm FROM monsters WHERE id=?1",
                [mid],
                |row| {
                    Ok(Monster {
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
                        generated_by_llm: row.get::<_, i64>(12)? == 1,
                    })
                },
            )
            .map_err(|e| format!("Monster query failed: {e}"))?;
        monsters.push(mon);
    }

    Ok(Some(StreamerLineup { hunter, monsters }))
}

/// Set the battle phase on the shared `BattleState`.
/// Used by the frontend to signal "draft" / "battle" / "complete".
#[tauri::command]
pub async fn set_battle_phase(
    state: State<'_, AppState>,
    phase: String,
) -> Result<(), String> {
    let mut battle = state
        .battle_state
        .write()
        .map_err(|e| format!("Lock error: {e}"))?;
    battle.phase = phase;
    Ok(())
}

/// Start a battle using the saved streamer lineup + the given chat monsters.
///
/// Validates that a streamer lineup exists, loads both teams from DB,
/// populates `BattleState`, and sets phase to "battle".
#[tauri::command]
pub async fn start_battle(
    state: State<'_, AppState>,
    chat_monster_ids: Vec<i64>,
) -> Result<BattleState, String> {
    if chat_monster_ids.is_empty() || chat_monster_ids.len() > 3 {
        return Err("Need 1–3 chat monsters".into());
    }

    let db = state.db.lock().await;

    // 1. Load streamer lineup
    let (_hunter_id, m1, m2, m3): (i64, i64, i64, i64) = db
        .query_row(
            "SELECT hunter_id, slot1_monster_id, slot2_monster_id, slot3_monster_id FROM streamer_lineup WHERE id=1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Save a streamer lineup first!".to_string())?;

    // 2. Converts a DB Monster row into a BattleMon
    let mon_to_battle = |id: i64, name: String, mtype: String, hp: i64, mp: i64, str_: i64, agi: i64, dex: i64, int_: i64, luck: i64| -> BattleMon {
        BattleMon {
            id,
            name,
            monster_type: mtype,
            hp,
            max_hp: hp,
            mp,
            max_mp: mp,
            str_stat: str_,
            agi,
            dex,
            int_stat: int_,
            luck,
            active_status: None,
            is_ko: false,
        }
    };

    // 3. Load streamer team (3 monsters from lineup)
    let streamer_ids = [m1, m2, m3];
    let mut streamer_team = Vec::with_capacity(3);
    for mid in &streamer_ids {
        let mon = db
            .query_row(
                "SELECT id, name, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck FROM monsters WHERE id=?1",
                [mid],
                |row| {
                    Ok(mon_to_battle(
                        row.get(0)?, row.get(1)?, row.get(2)?,
                        row.get(3)?, row.get(4)?, row.get(5)?,
                        row.get(6)?, row.get(7)?, row.get(8)?, row.get(9)?,
                    ))
                },
            )
            .map_err(|e| format!("Streamer monster query failed: {e}"))?;
        streamer_team.push(mon);
    }

    // 4. Load chat team from IDs
    let mut chat_team = Vec::with_capacity(chat_monster_ids.len());
    for cid in &chat_monster_ids {
        let mon = db
            .query_row(
                "SELECT id, name, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck FROM monsters WHERE id=?1",
                [cid],
                |row| {
                    Ok(mon_to_battle(
                        row.get(0)?, row.get(1)?, row.get(2)?,
                        row.get(3)?, row.get(4)?, row.get(5)?,
                        row.get(6)?, row.get(7)?, row.get(8)?, row.get(9)?,
                    ))
                },
            )
            .map_err(|e| format!("Chat monster query failed: {e}"))?;
        chat_team.push(mon);
    }

    // 5. Populate battle state
    let battle = BattleState {
        streamer_team,
        chat_team,
        turn_number: 0,
        winner: None,
        turn_log: vec![],
        phase: "battle".into(),
        poll_duration_secs: 0,
        poll_started_at_ms: 0,
        started_at_ms: crate::util::now_ms(),
        twitch_connected: false,
    };

    let mut shared = state
        .battle_state
        .write()
        .map_err(|e| format!("Lock error: {e}"))?;
    *shared = battle.clone();

    Ok(battle)
}
