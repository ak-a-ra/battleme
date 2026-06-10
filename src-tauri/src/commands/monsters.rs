use crate::AppState;
use crate::db::models::Monster;

#[tauri::command]
pub async fn get_monsters(state: tauri::State<'_, AppState>) -> Result<Vec<Monster>, String> {
    let db = state.db.lock().await;
    let mut stmt = db
        .prepare("SELECT id, name, sprite_id, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck, lore, generated_by_llm FROM monsters ORDER BY id")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Monster {
                id: row.get::<_, i64>(0)?,
                name: row.get::<_, String>(1)?,
                sprite_id: row.get::<_, String>(2)?,
                monster_type: row.get::<_, String>(3)?,
                hp: row.get::<_, i64>(4)?,
                mp: row.get::<_, i64>(5)?,
                str_stat: row.get::<_, i64>(6)?,
                agi: row.get::<_, i64>(7)?,
                dex: row.get::<_, i64>(8)?,
                int_stat: row.get::<_, i64>(9)?,
                luck: row.get::<_, i64>(10)?,
                lore: row.get::<_, String>(11)?,
                generated_by_llm: row.get::<_, i64>(12)? == 1,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub async fn create_monster(
    state: tauri::State<'_, AppState>,
    monster: Monster,
) -> Result<i64, String> {
    let db = state.db.lock().await;
    db.execute(
        "INSERT INTO monsters (name, sprite_id, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck, lore, generated_by_llm) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            monster.name,
            monster.sprite_id,
            monster.monster_type,
            monster.hp,
            monster.mp,
            monster.str_stat,
            monster.agi,
            monster.dex,
            monster.int_stat,
            monster.luck,
            monster.lore,
            monster.generated_by_llm as i64,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub async fn update_monster(
    state: tauri::State<'_, AppState>,
    monster: Monster,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute(
        "UPDATE monsters SET name=?1, sprite_id=?2, monster_type=?3, hp=?4, mp=?5, str_stat=?6, agi=?7, dex=?8, int_stat=?9, luck=?10, lore=?11, generated_by_llm=?12 WHERE id=?13",
        rusqlite::params![
            monster.name,
            monster.sprite_id,
            monster.monster_type,
            monster.hp,
            monster.mp,
            monster.str_stat,
            monster.agi,
            monster.dex,
            monster.int_stat,
            monster.luck,
            monster.lore,
            monster.generated_by_llm as i64,
            monster.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_monster(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute("DELETE FROM monsters WHERE id=?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
