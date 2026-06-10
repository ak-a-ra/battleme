// settings commands — read/write .env settings (no DB needed)

use std::collections::HashMap;

// ---------------------------------------------------------------------------
// get_settings – reload .env and return known settings as HashMap
// ---------------------------------------------------------------------------
#[tauri::command]
pub fn get_settings() -> HashMap<String, String> {
    dotenvy::dotenv().ok();

    let keys = ["TWITCH_CLIENT_ID", "TWITCH_CHANNEL_NAME", "ANTHROPIC_API_KEY"];

    keys.iter()
        .map(|&k| (k.to_string(), std::env::var(k).unwrap_or_default()))
        .collect()
}

// ---------------------------------------------------------------------------
// save_settings – write known settings to .env (KEY=VALUE per line)
// ---------------------------------------------------------------------------
#[tauri::command]
pub fn save_settings(settings: HashMap<String, String>) {
    let known_keys = ["TWITCH_CLIENT_ID", "TWITCH_CHANNEL_NAME", "ANTHROPIC_API_KEY"];

    let content = known_keys
        .iter()
        .map(|&k| {
            let v = settings.get(k).map(|s| s.as_str()).unwrap_or("");
            format!("{k}={v}\n")
        })
        .collect::<String>();

    std::fs::write(".env", content).expect("Failed to write .env");
}
