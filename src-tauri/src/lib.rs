// BattleMe — Rust backend entry point
//
// Task 01: Scaffold — module stubs.
// Task 02: Database — SQLite init with migrations + seed.
// Task 03: Commands — Tauri invoke handlers with AppState.

mod commands;
mod db;
mod battle;
mod twitch;
mod bridge;

use std::sync::{Arc, RwLock};
use tauri::Manager;

/// Shared application state passed to all Tauri commands via `tauri::State`.
pub struct AppState {
    pub db: tokio::sync::Mutex<rusqlite::Connection>,
    pub battle_state: Arc<RwLock<battle::types::BattleState>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Create shared battle state BEFORE the builder so the bridge and AppState
    // can both clone the same Arc (cheap refcount bump).
    let battle_state: Arc<RwLock<battle::types::BattleState>> =
        Arc::new(RwLock::new(battle::types::BattleState::default()));

    tauri::Builder::default()
        .setup(move |app| {
            // Start HTTP bridge first (background thread, non-blocking).
            // Degrades gracefully if port is in use.
            bridge::start(battle_state.clone());

            // Resolve DB path: app_data_dir in production, CWD as dev fallback.
            let db_path = {
                let mut path = app.path().app_data_dir().expect("Failed to resolve app data dir");
                std::fs::create_dir_all(&path).expect("Failed to create app data dir");
                path.push("battleme.db");
                path
            };

            let conn =
                rusqlite::Connection::open(&db_path).expect("Failed to open database at {db_path:?}");
            db::migrations::run(&conn);
            db::seed::run_if_empty(&conn);

            app.manage(AppState {
                db: tokio::sync::Mutex::new(conn),
                battle_state: battle_state.clone(),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::monsters::get_monsters,
            commands::monsters::create_monster,
            commands::monsters::update_monster,
            commands::monsters::delete_monster,
            commands::hunters::get_hunters,
            commands::hunters::create_hunter,
            commands::hunters::update_hunter,
            commands::hunters::delete_hunter,
            commands::abilities::get_abilities_for_monster,
            commands::abilities::create_ability,
            commands::abilities::update_ability,
            commands::abilities::delete_ability,
            commands::abilities::assign_ability_to_monster,
            commands::status_effects::get_status_effects,
            commands::status_effects::create_status_effect,
            commands::status_effects::update_status_effect,
            commands::status_effects::delete_status_effect,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::battle::resolve_turn,
            commands::twitch::start_poll,
            commands::twitch::get_broadcaster_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
