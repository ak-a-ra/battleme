use crate::AppState;
use crate::db::models::Ability;

#[tauri::command]
pub async fn get_abilities_for_monster(
    state: tauri::State<'_, AppState>,
    monster_id: i64,
) -> Result<Vec<Ability>, String> {
    let db = state.db.lock().await;
    let mut stmt = db
        .prepare(
            "SELECT a.id, a.name, a.mp_cost, a.power, a.ability_type, a.effect, \
                    a.status_inflict_id, a.is_passive \
             FROM abilities a \
             INNER JOIN monster_abilities ma ON a.id = ma.ability_id \
             WHERE ma.monster_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([monster_id], |row| {
            Ok(Ability {
                id: row.get::<_, i64>(0)?,
                name: row.get::<_, String>(1)?,
                mp_cost: row.get::<_, i64>(2)?,
                power: row.get::<_, i64>(3)?,
                ability_type: row.get::<_, String>(4)?,
                effect: row.get::<_, String>(5)?,
                status_inflict_id: row.get::<_, Option<i64>>(6)?,
                is_passive: row.get::<_, i64>(7)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub async fn create_ability(
    state: tauri::State<'_, AppState>,
    ability: Ability,
) -> Result<i64, String> {
    let db = state.db.lock().await;
    db.execute(
        "INSERT INTO abilities (name, mp_cost, power, ability_type, effect, status_inflict_id, is_passive) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            ability.name,
            ability.mp_cost,
            ability.power,
            ability.ability_type,
            ability.effect,
            ability.status_inflict_id,
            ability.is_passive as i64,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub async fn update_ability(
    state: tauri::State<'_, AppState>,
    ability: Ability,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute(
        "UPDATE abilities SET name=?1, mp_cost=?2, power=?3, ability_type=?4, effect=?5, \
         status_inflict_id=?6, is_passive=?7 WHERE id=?8",
        rusqlite::params![
            ability.name,
            ability.mp_cost,
            ability.power,
            ability.ability_type,
            ability.effect,
            ability.status_inflict_id,
            ability.is_passive as i64,
            ability.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_ability(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute("DELETE FROM abilities WHERE id=?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn assign_ability_to_monster(
    state: tauri::State<'_, AppState>,
    monster_id: i64,
    ability_id: i64,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute(
        "INSERT OR IGNORE INTO monster_abilities (monster_id, ability_id) VALUES (?1, ?2)",
        rusqlite::params![monster_id, ability_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
