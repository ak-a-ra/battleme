use crate::AppState;
use crate::db::models::Hunter;

#[tauri::command]
pub async fn get_hunters(state: tauri::State<'_, AppState>) -> Result<Vec<Hunter>, String> {
    let db = state.db.lock().await;
    let mut stmt = db
        .prepare("SELECT id, name, sprite_id, class, hp, mp, str_stat, agi, dex, int_stat, luck, lore FROM hunters ORDER BY id")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Hunter {
                id: row.get::<_, i64>(0)?,
                name: row.get::<_, String>(1)?,
                sprite_id: row.get::<_, String>(2)?,
                class: row.get::<_, String>(3)?,
                hp: row.get::<_, i64>(4)?,
                mp: row.get::<_, i64>(5)?,
                str_stat: row.get::<_, i64>(6)?,
                agi: row.get::<_, i64>(7)?,
                dex: row.get::<_, i64>(8)?,
                int_stat: row.get::<_, i64>(9)?,
                luck: row.get::<_, i64>(10)?,
                lore: row.get::<_, String>(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub async fn create_hunter(
    state: tauri::State<'_, AppState>,
    hunter: Hunter,
) -> Result<i64, String> {
    let db = state.db.lock().await;
    db.execute(
        "INSERT INTO hunters (name, sprite_id, class, hp, mp, str_stat, agi, dex, int_stat, luck, lore) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            hunter.name,
            hunter.sprite_id,
            hunter.class,
            hunter.hp,
            hunter.mp,
            hunter.str_stat,
            hunter.agi,
            hunter.dex,
            hunter.int_stat,
            hunter.luck,
            hunter.lore,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub async fn update_hunter(
    state: tauri::State<'_, AppState>,
    hunter: Hunter,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute(
        "UPDATE hunters SET name=?1, sprite_id=?2, class=?3, hp=?4, mp=?5, str_stat=?6, agi=?7, dex=?8, int_stat=?9, luck=?10, lore=?11 WHERE id=?12",
        rusqlite::params![
            hunter.name,
            hunter.sprite_id,
            hunter.class,
            hunter.hp,
            hunter.mp,
            hunter.str_stat,
            hunter.agi,
            hunter.dex,
            hunter.int_stat,
            hunter.luck,
            hunter.lore,
            hunter.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_hunter(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute("DELETE FROM hunters WHERE id=?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
