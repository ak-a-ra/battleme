use crate::battle::types::BattleState;
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::json;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio_tungstenite::connect_async;

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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_session_welcome_parse() {
        let json = json!({
            "metadata": {
                "message_type": "session_welcome",
                "message_id": "msg_123"
            },
            "payload": {
                "session": {
                    "id": "session_abc123",
                    "status": "connected",
                    "connected_at": "2024-01-01T00:00:00Z",
                    "keepalive_timeout_seconds": 10
                }
            }
        });
        let msg_type = json["metadata"]["message_type"].as_str().unwrap_or("");
        assert_eq!(msg_type, "session_welcome");
        let session_id = json["payload"]["session"]["id"].as_str().unwrap_or("");
        assert_eq!(session_id, "session_abc123");
    }

    #[test]
    fn test_notification_poll_end_parse() {
        let json = json!({
            "metadata": {
                "message_type": "notification",
                "subscription_type": "channel.poll.end"
            },
            "payload": {
                "subscription": {
                    "type": "channel.poll.end",
                    "id": "sub_123"
                },
                "event": {
                    "id": "poll_123",
                    "status": "completed",
                    "choices": [
                        {"title": "Basic Attack", "votes": 5},
                        {"title": "Fire Blast", "votes": 10}
                    ]
                }
            }
        });
        let sub_type = json["payload"]["subscription"]["type"].as_str().unwrap_or("");
        assert_eq!(sub_type, "channel.poll.end");
        let status = json["payload"]["event"]["status"].as_str().unwrap_or("");
        assert_eq!(status, "completed");
        let choices = json["payload"]["event"]["choices"].as_array().unwrap();
        assert_eq!(choices.len(), 2);
    }

    #[test]
    fn test_session_reconnect_parse() {
        let json = json!({
            "metadata": {
                "message_type": "session_reconnect"
            },
            "payload": {
                "session": {
                    "reconnect_url": "wss://eventsub.wss.twitch.tv/ws?session_id=abc"
                }
            }
        });
        let msg_type = json["metadata"]["message_type"].as_str().unwrap_or("");
        assert_eq!(msg_type, "session_reconnect");
        let reconnect_url = json["payload"]["session"]["reconnect_url"].as_str().unwrap_or("");
        assert!(!reconnect_url.is_empty());
    }

    #[test]
    fn test_subscribe_poll_end_body() {
        let body = json!({
            "type": "channel.poll.end",
            "version": "1",
            "condition": {
                "broadcaster_user_id": "123456"
            },
            "transport": {
                "method": "websocket",
                "session_id": "session_abc"
            }
        });
        assert_eq!(body["type"], "channel.poll.end");
        assert_eq!(body["version"], "1");
        assert_eq!(body["condition"]["broadcaster_user_id"], "123456");
        assert_eq!(body["transport"]["method"], "websocket");
        assert_eq!(body["transport"]["session_id"], "session_abc");
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
                    let choices = &event["choices"];
                    let winning_index = event["status"].as_str().unwrap_or("");
                    let winning_title = if winning_index == "completed" {
                        choices
                            .as_array()
                            .and_then(|arr| {
                                arr.iter().find(|c| {
                                    c["votes"].as_i64().unwrap_or(0)
                                        > arr
                                            .iter()
                                            .filter_map(|c2| c2["votes"].as_i64())
                                            .max()
                                            .unwrap_or(0)
                                            - 1
                                })
                            })
                            .and_then(|c| c["title"].as_str())
                            .unwrap_or("Basic Attack")
                    } else {
                        "Basic Attack"
                    };
                    eprintln!("[twitch] poll.end winner: {winning_title}");

                    use tauri::Emitter;
                    app_handle
                        .emit("poll-result", winning_title.to_string())
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
