use futures_util::StreamExt;
use reqwest::Client;
use serde_json::json;
use tokio_tungstenite::connect_async;

/// Listen for Twitch EventSub events via WebSocket.
///
/// Flow:
/// 1. Connect to wss://eventsub.wss.twitch.tv/ws
/// 2. Receive `session_welcome` → extract `session_id`
/// 3. POST /helix/eventsub/subscriptions with `channel.poll.end`
/// 4. On `poll.end` notification → emit `poll-result` via Tauri emitter
pub async fn listen(
    app_handle: tauri::AppHandle,
    token: String,
    client_id: String,
    broadcaster_id: String,
) {
    let ws_url = "wss://eventsub.wss.twitch.tv/ws";
    let (ws_stream, _) = match connect_async(ws_url).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[twitch] EventSub WebSocket connect failed: {e}");
            return;
        }
    };

    let (write, mut read) = ws_stream.split();

    // Buffer for incoming messages, accumulate JSON chunks
    let mut buf = String::new();

    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[twitch] WebSocket recv error: {e}");
                break;
            }
        };

        // Twitch EventSub sends JSON text frames
        if !msg.is_text() {
            continue;
        }
        buf.push_str(msg.to_text().unwrap_or(""));

        // Try to parse a complete JSON message
        let parsed: serde_json::Value = match serde_json::from_str(&buf) {
            Ok(v) => {
                buf.clear();
                v
            }
            Err(_) => continue, // incomplete frame, wait for more
        };

        let metadata = &parsed["metadata"];
        let msg_type = metadata["message_type"].as_str().unwrap_or("");

        match msg_type {
            "session_welcome" => {
                let session_id = parsed["payload"]["session"]["id"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                if session_id.is_empty() {
                    eprintln!("[twitch] empty session_id in welcome");
                    continue;
                }
                eprintln!("[twitch] session_welcome: {session_id}");

                // Subscribe to channel.poll.end
                if let Err(e) = subscribe_poll_end(
                    &client_id,
                    &token,
                    &broadcaster_id,
                    &session_id,
                )
                .await
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
                    // Extract the winning choice title
                    let choices = &event["choices"];
                    let winning_index = event["status"].as_str().unwrap_or("");
                    let winning_title = if winning_index == "completed" {
                        choices
                            .as_array()
                            .and_then(|arr| {
                                arr.iter().find(|c| {
                                    c["votes"].as_i64().unwrap_or(0)
                                        > arr.iter()
                                            .filter_map(|c2| c2["votes"].as_i64())
                                            .max()
                                            .unwrap_or(0)
                                            - 1
                                })
                            })
                            .and_then(|c| c["title"].as_str())
                            .unwrap_or("Basic Attack")
                    } else {
                        // Poll was terminated or archived — default
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
                    .unwrap_or("");
                eprintln!("[twitch] session_reconnect: {reconnect_url}");
                // In v1, just log. Full reconnect would close current WS
                // and connect to the new URL.
                break;
            }
            "session_keepalive" => {
                // Twitch sends periodic keepalive — no action needed
            }
            _ => {
                eprintln!("[twitch] unknown message_type: {msg_type}");
            }
        }
    }

    // Drop write — WebSocket will close
    drop(write);
    eprintln!("[twitch] EventSub listener disconnected");
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
