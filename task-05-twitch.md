# Task 05: Twitch Integration

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Connect to Twitch via EventSub, create polls per turn, receive poll results.

**Architecture:** Rust handles Twitch OAuth app token (client credentials flow), creates polls via Twitch API, listens for poll end events via EventSub WebSocket. Results emitted to React via Tauri events.

**Tech Stack:** reqwest, tokio, tauri::Emitter, .env credentials

---

### Step 1: Add dependencies
```toml
# src-tauri/Cargo.toml
[dependencies]
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
```

---

### Step 2: Create twitch module
```
src-tauri/src/twitch/
  mod.rs
  auth.rs
  polls.rs
  eventsub.rs
```

---

### Step 3: App token auth (client credentials)
```rust
// src-tauri/src/twitch/auth.rs
use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

pub async fn get_app_token(client_id: &str, client_secret: &str) -> String {
    let client = Client::new();
    let res: TokenResponse = client
        .post("https://id.twitch.tv/oauth2/token")
        .query(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("grant_type", "client_credentials"),
        ])
        .send().await.unwrap()
        .json().await.unwrap();
    res.access_token
}
```

---

### Step 4: Create Twitch poll
```rust
// src-tauri/src/twitch/polls.rs
use reqwest::Client;
use serde_json::json;

pub async fn create_poll(
    client_id: &str,
    token: &str,
    broadcaster_id: &str,
    title: &str,
    choices: Vec<&str>,
    duration_secs: u32,
) -> String {
    let client = Client::new();
    let body = json!({
        "broadcaster_id": broadcaster_id,
        "title": title,
        "choices": choices.iter().map(|c| json!({"title": c})).collect::<Vec<_>>(),
        "duration": duration_secs,
    });
    let res: serde_json::Value = client
        .post("https://api.twitch.tv/helix/polls")
        .header("Client-Id", client_id)
        .bearer_auth(token)
        .json(&body)
        .send().await.unwrap()
        .json().await.unwrap();
    // Return poll id
    res["data"][0]["id"].as_str().unwrap_or("").to_string()
}
```

---

### Step 5: EventSub WebSocket listener
```rust
// src-tauri/src/twitch/eventsub.rs
// Connect to wss://eventsub.wss.twitch.tv/ws
// Subscribe to channel.poll.end event
// On poll end: emit result to React via tauri::Emitter

pub async fn listen(app_handle: tauri::AppHandle, token: String, client_id: String) {
    // WebSocket connect → receive session_welcome → subscribe to poll.end
    // On poll.end notification → emit "poll-result" event to frontend
    use tauri::Emitter;
    app_handle.emit("poll-result", winning_choice).unwrap();
}
```

---

### Step 6: Expose Twitch commands
```rust
// src-tauri/src/commands/twitch.rs
#[tauri::command]
pub async fn start_poll(
    state: State<AppState>,
    app: tauri::AppHandle,
    title: String,
    choices: Vec<String>,
    duration_secs: u32,
) -> String {
    // load .env creds → get token → create poll → start eventsub listener
}

#[tauri::command]
pub async fn get_broadcaster_id(state: State<AppState>) -> String {
    // GET /helix/users?login=CHANNEL_NAME → return broadcaster id
}
```

---

### Step 7: React poll result listener
```ts
// src/hooks/useTwitchPoll.ts
import { listen } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'

export function useTwitchPoll() {
    const [result, setResult] = useState<string | null>(null)
    useEffect(() => {
        const unlisten = listen('poll-result', (e) => {
            setResult(e.payload as string)
        })
        return () => { unlisten.then(f => f()) }
    }, [])
    return result
}
```

---

### Step 8: Test mode stub
```rust
// In start_poll command: if TWITCH_CLIENT_ID is empty, emit fake poll result after duration
if client_id.is_empty() {
    tokio::time::sleep(Duration::from_secs(duration_secs as u64)).await;
    app.emit("poll-result", "Basic Attack").unwrap();
}
```

---

### Step 9: Commit
```bash
git add .
git commit -m "feat: twitch integration — polls, eventsub, test mode stub"
```
