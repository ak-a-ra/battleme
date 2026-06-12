use crate::battle::engine;
use crate::battle::types::{AbilityInput, BattleState};
use crate::db::models::BattleLog;
use crate::AppState;

#[tauri::command]
pub async fn resolve_turn(
    state: tauri::State<'_, AppState>,
    streamer_move: AbilityInput,
    chat_move: AbilityInput,
) -> Result<BattleState, String> {
    let mut battle = state
        .battle_state
        .write()
        .map_err(|e| format!("Lock error: {}", e))?;

    engine::resolve(&mut battle, &streamer_move, &chat_move);

    Ok(battle.clone())
}

/// Read the current BattleState from shared memory.
#[tauri::command]
pub async fn get_battle_state(
    state: tauri::State<'_, AppState>,
) -> Result<BattleState, String> {
    let battle = state
        .battle_state
        .read()
        .map_err(|e| format!("Lock error: {}", e))?;
    Ok(battle.clone())
}

/// Resolve an ability ID into an `AbilityInput`.
///
/// Special case: ability_id=0 returns a Basic Attack (no DB lookup).
/// Otherwise looks up the ability + optional status effect.
#[tauri::command]
pub async fn get_ability_input(
    state: tauri::State<'_, AppState>,
    ability_id: i64,
) -> Result<AbilityInput, String> {
    if ability_id == 0 {
        return Ok(AbilityInput {
            name: "Basic Attack".into(),
            base_power: 10,
            ability_type: "physical".into(),
            status_inflict_name: None,
            status_duration: 0,
        });
    }

    let db = state.db.lock().await;

    let (name, power, ability_type, status_id): (String, i64, String, Option<i64>) = db
        .query_row(
            "SELECT name, power, ability_type, status_inflict_id FROM abilities WHERE id=?1",
            [ability_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| format!("Ability not found: id={ability_id}"))?;

    let (status_name, status_duration): (Option<String>, i64) = if let Some(sid) = status_id {
        let (sname, sdur): (String, i64) = db
            .query_row(
                "SELECT name, duration FROM status_effects WHERE id=?1",
                [sid],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| format!("Status effect lookup failed: {e}"))?;
        (Some(sname), sdur)
    } else {
        (None, 0)
    };

    Ok(AbilityInput {
        name,
        base_power: power,
        ability_type,
        status_inflict_name: status_name,
        status_duration,
    })
}

/// Surrender — set the winner, mark phase complete. Does NOT write to battle_logs;
/// the streamer must click "Save Result" for that.
#[tauri::command]
pub async fn surrender(
    state: tauri::State<'_, AppState>,
    winner_side: String,
) -> Result<BattleState, String> {
    let result = {
        let mut battle = state
            .battle_state
            .write()
            .map_err(|e| format!("Lock error: {}", e))?;

        battle.winner = Some(winner_side);
        battle.phase = "complete".into();
        battle.clone()
    };

    Ok(result)
}

/// Save the current battle result to DB (idempotent — no-op if winner not set).
#[tauri::command]
pub async fn save_battle_result(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // Clone data while holding lock, then drop it
    let (winner, streamer_ids, chat_ids, turn_log, duration_secs) = {
        let battle = state
            .battle_state
            .read()
            .map_err(|e| format!("Lock error: {}", e))?;

        let winner = match &battle.winner {
            Some(w) => w.clone(),
            None => return Err("No winner to save".into()),
        };
        let streamer_ids: Vec<i64> = battle.streamer_team.iter().map(|m| m.id).collect();
        let chat_ids: Vec<i64> = battle.chat_team.iter().map(|m| m.id).collect();
        let turn_log = battle.turn_log.clone();
        let started = battle.started_at_ms;
        let duration_secs = if started > 0 {
            ((crate::util::now_ms() - started) / 1000) as i64
        } else {
            0
        };
        (winner, streamer_ids, chat_ids, turn_log, duration_secs)
    }; // RwLock guard dropped here

    let db = state.db.lock().await;
    db.execute(
        "INSERT INTO battle_logs (date, winner_side, streamer_team, chat_team, turns, duration_secs)
         VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            winner,
            serde_json::to_string(&streamer_ids).unwrap_or_default(),
            serde_json::to_string(&chat_ids).unwrap_or_default(),
            serde_json::to_string(&turn_log).unwrap_or_default(),
            duration_secs,
        ],
    )
    .map_err(|e| format!("DB error: {e}"))?;

    Ok(())
}

/// Get the most recent battle logs (up to 50).
#[tauri::command]
pub async fn get_battle_logs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BattleLog>, String> {
    let db = state.db.lock().await;
    let mut stmt = db
        .prepare(
            "SELECT id, date, winner_side, streamer_team, chat_team, turns, duration_secs
             FROM battle_logs ORDER BY id DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;
    let logs = stmt
        .query_map([], |row| {
            Ok(BattleLog {
                id: row.get(0)?,
                date: row.get(1)?,
                winner_side: row.get(2)?,
                streamer_team: row.get(3)?,
                chat_team: row.get(4)?,
                turns: row.get(5)?,
                duration_secs: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(logs)
}

/// Get a single battle log by ID.
#[tauri::command]
pub async fn get_battle_log(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<Option<BattleLog>, String> {
    let db = state.db.lock().await;
    let mut stmt = db
        .prepare(
            "SELECT id, date, winner_side, streamer_team, chat_team, turns, duration_secs
             FROM battle_logs WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map([id], |row| {
            Ok(BattleLog {
                id: row.get(0)?,
                date: row.get(1)?,
                winner_side: row.get(2)?,
                streamer_team: row.get(3)?,
                chat_team: row.get(4)?,
                turns: row.get(5)?,
                duration_secs: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(Ok(log)) => Ok(Some(log)),
        _ => Ok(None),
    }
}
