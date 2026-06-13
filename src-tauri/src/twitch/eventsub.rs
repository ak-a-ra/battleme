use crate::battle::types::BattleState;
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::json;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio_tungstenite::connect_async;

/// Extract the winning choice title from a channel.poll.end event.
fn extract_poll_winner(event: &serde_json::Value) -> String {
    let choices = &event["choices"];
    choices
        .as_array()
        .and_then(|arr| {
            arr.iter().max_by_key(|c| c["votes"].as_i64().unwrap_or(0))
        })
        .and_then(|c| c["title"].as_str())
        .unwrap_or("Basic Attack")
        .to_string()
}

/// Listen for Twitch EventSub events via WebSocket with auto-reconnect.
///
/// Runs in a `loop { ... }` with exponential backoff (1s → 30s cap).
/// On successful `session_welcome`, sets `twitch_connected = true` on
/// the shared battle state. On disconnect/error, sets it to `false`.
pub async fn listen(
    app_handle: tauri::AppHandle,
    battle_state: Arc<RwLock<BattleState>>,
    token: String,
    client_id: String,
    broadcaster_id: String,
) {
    let mut delay = 1u64;
    loop {
        eprintln!("[twitch] EventSub connecting...");
        let result = listen_once(
            &app_handle,
            &battle_state,
            &token,
            &client_id,
            &broadcaster_id,
        )
        .await;

        match &result {
            Ok(()) => eprintln!("[twitch] EventSub listener exited cleanly"),
            Err(e) => eprintln!("[twitch] EventSub error: {e}"),
        }

        // Mark disconnected
        {
            let mut bs = battle_state.write().unwrap();
            bs.twitch_connected = false;
        }

        eprintln!("[twitch] reconnecting in {delay}s...");
        tokio::time::sleep(Duration::from_secs(delay)).await;
        delay = (delay * 2).min(30);
    }
}

/// Single EventSub WebSocket session — connects, subscribes, processes messages.
/// Returns Ok when the session ends cleanly, Err on failure.
async fn listen_once(
    app_handle: &tauri::AppHandle,
    battle_state: &Arc<RwLock<BattleState>>,
    token: &str,
    client_id: &str,
    broadcaster_id: &str,
) -> Result<(), String> {
    let ws_url = "wss://eventsub.wss.twitch.tv/ws";
    let (ws_stream, _) = connect_async(ws_url)
        .await
        .map_err(|e| format!("WebSocket connect failed: {e}"))?;

    let (_write, mut read) = ws_stream.split();

    let mut buf = String::new();

    while let Some(msg) = read.next().await {
        let msg = msg.map_err(|e| format!("WebSocket recv error: {e}"))?;

        if !msg.is_text() {
            continue;
        }
        buf.push_str(msg.to_text().unwrap_or(""));

        let parsed: serde_json::Value = match serde_json::from_str(&buf) {
            Ok(v) => {
                buf.clear();
                v
            }
            Err(_) => continue,
        };

        let metadata = &parsed["metadata"];
        let msg_type = metadata["message_type"].as_str().unwrap_or("");

        match msg_type {
            "session_welcome" => {
                // Mark connected
                {
                    let mut bs = battle_state.write().unwrap();
                    bs.twitch_connected = true;
                }

                let session_id = parsed["payload"]["session"]["id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                if session_id.is_empty() {
                    eprintln!("[twitch] empty session_id in welcome");
                    continue;
                }
                eprintln!("[twitch] session_welcome: {session_id}");

                if let Err(e) =
                    subscribe_poll_end(client_id, token, broadcaster_id, &session_id).await
                {
                    eprintln!("[twitch] subscribe failed: {e}");
                }
            }
            "notification" => {
                let sub_type = parsed["payload"]["subscription"]["type"]
                    .as_str()
                    .unwrap_or("");
                eprintln!("[twitch] notification: {sub_type}");

                if sub_type == "channel.poll.end" {
                    let event = &parsed["payload"]["event"];
                    let status = event["status"].as_str().unwrap_or("");

                    let winning_title = extract_poll_winner(event);

                    eprintln!("[twitch] poll.end status={status} winner={winning_title}");

                    use tauri::Emitter;
                    app_handle
                        .emit("poll-result", winning_title)
                        .unwrap_or_else(|e| eprintln!("[twitch] emit failed: {e}"));
                }
            }
            "session_reconnect" => {
                let reconnect_url = parsed["payload"]["session"]["reconnect_url"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                eprintln!("[twitch] session_reconnect: {reconnect_url}");
                // Return so the outer loop reconnects
                return Err("reconnect requested".into());
            }
            "session_keepalive" => {}
            _ => {
                eprintln!("[twitch] unknown message_type: {msg_type}");
            }
        }
    }

    Ok(())
}

/// Subscribe to `channel.poll.end` EventSub via Helix API.
async fn subscribe_poll_end(
    client_id: &str,
    token: &str,
    broadcaster_id: &str,
    session_id: &str,
) -> Result<(), String> {
    let client = Client::new();
    let body = json!({
        "type": "channel.poll.end",
        "version": "1",
        "condition": {
            "broadcaster_user_id": broadcaster_id
        },
        "transport": {
            "method": "websocket",
            "session_id": session_id
        }
    });

    let res: serde_json::Value = client
        .post("https://api.twitch.tv/helix/eventsub/subscriptions")
        .header("Client-Id", client_id)
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Subscribe request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Subscribe parse failed: {e}"))?;

    if let Some(errors) = res["errors"].as_array() {
        if !errors.is_empty() {
            return Err(format!("Subscribe API error: {errors:?}"));
        }
    }

    eprintln!("[twitch] subscribed to channel.poll.end");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_poll_winner_single_choice() {
        let event = json!({
            "choices": [
                { "title": "Fireball::5", "votes": 10 }
            ],
            "status": "completed"
        });
        let winner = extract_poll_winner(&event);
        assert_eq!(winner, "Fireball::5");
    }

    #[test]
    fn test_extract_poll_winner_multiple_choices() {
        let event = json!({
            "choices": [
                { "title": "Fireball::5", "votes": 10 },
                { "title": "Water Gun::3", "votes": 15 },
                { "title": "Basic Attack::0", "votes": 5 }
            ],
            "status": "completed"
        });
        let winner = extract_poll_winner(&event);
        assert_eq!(winner, "Water Gun::3");
    }

    #[test]
    fn test_extract_poll_winner_tie_returns_first() {
        let event = json!({
            "choices": [
                { "title": "Fireball::5", "votes": 10 },
                { "title": "Water Gun::3", "votes": 10 }
            ],
            "status": "completed"
        });
        let winner = extract_poll_winner(&event);
        assert_eq!(winner, "Fireball::5");
    }

    #[test]
    fn test_extract_poll_winner_terminated_status() {
        let event = json!({
            "choices": [
                { "title": "Fireball::5", "votes": 8 },
                { "title": "Basic Attack::0", "votes": 3 }
            ],
            "status": "terminated"
        });
        let winner = extract_poll_winner(&event);
        assert_eq!(winner, "Fireball::5");
    }

    #[test]
    fn test_extract_poll_winner_empty_choices() {
        let event = json!({
            "choices": [],
            "status": "completed"
        });
        let winner = extract_poll_winner(&event);
        assert_eq!(winner, "Basic Attack");
    }

    #[test]
    fn test_extract_poll_winner_missing_votes() {
        let event = json!({
            "choices": [
                { "title": "Fireball::5" },
                { "title": "Water Gun::3", "votes": 7 }
            ],
            "status": "completed"
        });
        let winner = extract_poll_winner(&event);
        assert_eq!(winner, "Water Gun::3");
    }

    #[test]
    fn test_subscribe_poll_end_body_structure() {
        let body = json!({
            "type": "channel.poll.end",
            "version": "1",
            "condition": {
                "broadcaster_user_id": "12345"
            },
            "transport": {
                "method": "websocket",
                "session_id": "session_abc"
            }
        });

        assert_eq!(body["type"], "channel.poll.end");
        assert_eq!(body["version"], "1");
        assert_eq!(body["condition"]["broadcaster_user_id"], "12345");
        assert_eq!(body["transport"]["method"], "websocket");
        assert_eq!(body["transport"]["session_id"], "session_abc");
    }

    #[test]
    fn test_session_welcome_session_id_extraction() {
        let parsed = json!({
            "metadata": { "message_type": "session_welcome" },
            "payload": {
                "session": { "id": "sess_12345" }
            }
        });
        let session_id = parsed["payload"]["session"]["id"]
            .as_str()
            .unwrap_or("")
            .to_string();
        assert_eq!(session_id, "sess_12345");
    }

    #[test]
    fn test_session_reconnect_url_extraction() {
        let parsed = json!({
            "metadata": { "message_type": "session_reconnect" },
            "payload": {
                "session": { "reconnect_url": "wss://eventsub.wss.twitch.tv/ws?session_id=xyz" }
            }
        });
        let reconnect_url = parsed["payload"]["session"]["reconnect_url"]
            .as_str()
            .unwrap_or("")
            .to_string();
        assert!(reconnect_url.contains("eventsub.wss.twitch.tv"));
    }
}
