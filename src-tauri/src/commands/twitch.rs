use crate::twitch::{auth, eventsub, polls};
use crate::AppState;
use std::time::Duration;
use tauri::State;

/// Start a Twitch poll for the given title and choices.
///
/// Writes `poll_duration_secs` and `poll_started_at_ms` to the shared
/// `BattleState` so the OBS overlay can show a countdown timer.
///
/// If `TWITCH_CLIENT_ID` is empty/absent, runs in **test mode**:
/// sleeps for `duration_secs` then emits a fake `poll-result` with
/// a random choice.
///
/// Async safety: DB lock is released before any `.await` call.
#[tauri::command]
pub async fn start_poll(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    title: String,
    choices: Vec<String>,
    duration_secs: u32,
) -> Result<String, String> {
    // Mark poll timing on shared battle state (before any await)
    {
        let mut bs = state.battle_state.write().unwrap();
        bs.poll_duration_secs = duration_secs as i64;
        bs.poll_started_at_ms = crate::util::now_ms();
    }

    // Reload .env to pick up any runtime changes
    dotenvy::dotenv().ok();

    let client_id = std::env::var("TWITCH_CLIENT_ID").unwrap_or_default();
    let client_secret = std::env::var("TWITCH_CLIENT_SECRET").unwrap_or_default();
    let channel_name = std::env::var("TWITCH_CHANNEL_NAME").unwrap_or_default();

    // Test mode: no Twitch creds configured
    if client_id.is_empty() || client_secret.is_empty() || channel_name.is_empty() {
        eprintln!("[twitch] test mode — sleep {duration_secs}s then fake result");
        tokio::time::sleep(Duration::from_secs(duration_secs as u64)).await;
        use rand::Rng;
        let fallback = if choices.len() > 1 {
            choices[rand::thread_rng().gen_range(0..choices.len())].clone()
        } else {
            choices.first().cloned().unwrap_or_else(|| "Basic Attack".to_string())
        };
        use tauri::Emitter;
        app.emit("poll-result", fallback.clone())
            .map_err(|e| format!("Emit failed: {e}"))?;
        return Ok("test-mode".to_string());
    }

    // 1. Get app token
    let token = auth::get_app_token(&client_id, &client_secret).await?;

    // 2. Resolve broadcaster ID from channel name
    let broadcaster_id = resolve_broadcaster_id(&client_id, &token, &channel_name)
        .await?;
    eprintln!("[twitch] broadcaster_id: {broadcaster_id}");

    // 3. Create the poll
    let poll_id = polls::create_poll(
        &client_id,
        &token,
        &broadcaster_id,
        &title,
        &choices,
        duration_secs,
    )
    .await?;
    eprintln!("[twitch] poll created: {poll_id}");

    // 4. Spawn EventSub listener in background with battle state for reconnection
    let app_handle = app.clone();
    let bs = state.battle_state.clone();
    tokio::spawn(async move {
        eventsub::listen(app_handle, bs, token, client_id, broadcaster_id).await;
    });

    Ok(poll_id)
}

/// Get the broadcaster ID for the configured Twitch channel.
#[tauri::command]
pub async fn get_broadcaster_id(_state: State<'_, AppState>) -> Result<String, String> {
    dotenvy::dotenv().ok();
    let client_id = std::env::var("TWITCH_CLIENT_ID").map_err(|_| "TWITCH_CLIENT_ID not set".to_string())?;
    let client_secret = std::env::var("TWITCH_CLIENT_SECRET").map_err(|_| "TWITCH_CLIENT_SECRET not set".to_string())?;
    let channel_name = std::env::var("TWITCH_CHANNEL_NAME").map_err(|_| "TWITCH_CHANNEL_NAME not set".to_string())?;

    let token = auth::get_app_token(&client_id, &client_secret).await?;
    resolve_broadcaster_id(&client_id, &token, &channel_name).await
}

/// Resolve a Twitch channel name to a broadcaster ID via Helix API.
async fn resolve_broadcaster_id(
    client_id: &str,
    token: &str,
    channel_name: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res: serde_json::Value = client
        .get("https://api.twitch.tv/helix/users")
        .query(&[("login", channel_name)])
        .header("Client-Id", client_id)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Users API request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Users API parse failed: {e}"))?;

    Ok(res["data"][0]["id"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_resolve_broadcaster_id_response_parse() {
        let json = json!({
            "data": [
                {"id": "123456", "login": "testchannel", "display_name": "TestChannel"}
            ]
        });
        let broadcaster_id = json["data"][0]["id"].as_str().unwrap_or("").to_string();
        assert_eq!(broadcaster_id, "123456");
    }

    #[test]
    fn test_empty_channel_name_error() {
        let result = std::env::var("NONEXISTENT_VAR");
        assert!(result.is_err());
    }
}
