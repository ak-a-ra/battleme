// BattleMe — Rust backend entry point
//
// Task 01: Scaffold — module stubs are created here.
// They will be wired up in subsequent tasks.

mod commands;
mod db;
mod battle;
mod twitch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
