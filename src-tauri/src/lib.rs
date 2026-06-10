// BattleMe — Rust backend entry point
//
// Task 01: Scaffold — module stubs are created here.
// Task 02: Database — SQLite init with migrations + seed.

mod commands;
mod db;
mod battle;
mod twitch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize SQLite database with migrations and seed data.
    // Dev fallback: CWD path. Production uses app.path().app_data_dir() (wired in task-03).
    let conn = rusqlite::Connection::open("battleme.db").expect("Failed to open database");
    db::migrations::run(&conn);
    db::seed::run_if_empty(&conn);

    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
