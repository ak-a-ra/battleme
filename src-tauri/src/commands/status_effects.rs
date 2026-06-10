use crate::AppState;
use crate::db::models::StatusEffect;

#[tauri::command]
pub async fn get_status_effects(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<StatusEffect>, String> {
    let db = state.db.lock().await;
    let mut stmt = db
        .prepare(
            "SELECT id, name, icon, effect_per_turn, duration, visual_color \
             FROM status_effects ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(StatusEffect {
                id: row.get::<_, i64>(0)?,
                name: row.get::<_, String>(1)?,
                icon: row.get::<_, String>(2)?,
                effect_per_turn: row.get::<_, String>(3)?,
                duration: row.get::<_, i64>(4)?,
                visual_color: row.get::<_, String>(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub async fn create_status_effect(
    state: tauri::State<'_, AppState>,
    effect: StatusEffect,
) -> Result<i64, String> {
    let db = state.db.lock().await;
    db.execute(
        "INSERT INTO status_effects (name, icon, effect_per_turn, duration, visual_color) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            effect.name,
            effect.icon,
            effect.effect_per_turn,
            effect.duration,
            effect.visual_color,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub async fn update_status_effect(
    state: tauri::State<'_, AppState>,
    effect: StatusEffect,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute(
        "UPDATE status_effects SET name=?1, icon=?2, effect_per_turn=?3, duration=?4, \
         visual_color=?5 WHERE id=?6",
        rusqlite::params![
            effect.name,
            effect.icon,
            effect.effect_per_turn,
            effect.duration,
            effect.visual_color,
            effect.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_status_effect(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute(
        "DELETE FROM status_effects WHERE id=?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
