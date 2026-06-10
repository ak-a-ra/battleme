# Task 05: Twitch Integration

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Connect to Twitch via EventSub, create polls per turn, receive poll results.

**Architecture:** Rust handles Twitch OAuth app token (client credentials flow), creates polls via Twitch API, listens for poll end events via EventSub WebSocket. Results emitted to React via Tauri events (used by Dashboard, which is a Tauri window).

**Important:** The `listen()` flow only works in the Tauri window (Dashboard). The OBS overlay uses a separate HTTP bridge (see Task 01-b) — not this hook.

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

### Step 5: EventSub WebSocket listener + subscription
```rust
// src-tauri/src/twitch/eventsub.rs
// Full flow:
// 1. Connect WebSocket to wss://eventsub.wss.twitch.tv/ws
// 2. Receive session_welcome message → extract session_id
// 3. POST /helix/eventsub/subscriptions with:
//    {
//      "type": "channel.poll.end",
//      "version": "1",
//      "condition": { "broadcaster_user_id": "..." },
//      "transport": { "method": "websocket", "session_id": "..." }
//    }
// 4. On poll.end notification → emit "poll-result" event to frontend

pub async fn listen(
    app_handle: tauri::AppHandle,
    token: String,
    client_id: String,
    broadcaster_id: String,  // needed for subscription condition
) {
    // WebSocket connect → receive session_welcome → get session_id
    // POST /helix/eventsub/subscriptions with the session_id
    // On poll.end notification → emit result
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
    // NOTE: use tokio::sync::Mutex for DB — release lock before .await points
}

#[tauri::command]
pub async fn get_broadcaster_id(state: State<AppState>) -> String {
    // GET /helix/users?login=CHANNEL_NAME → return broadcaster id
}
```

> **Async safety:** Access DB in short sync blocks and release the `tokio::sync::Mutex` before any `.await`:
> ```rust
> let settings = {
>     let db = state.db.lock().await;
>     db.query(...)
> };  // lock dropped here
> let token = get_app_token(settings.client_id, settings.client_secret).await; // safe
> ```

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
// This simulates a Twitch poll without needing credentials — overlay still works
if client_id.is_empty() {
    tokio::time::sleep(Duration::from_secs(duration_secs as u64)).await;
    app.emit("poll-result", "Basic Attack").unwrap();
}
```

> **Note:** Dashboard listens for 'poll-result' via `useTwitchPoll()`. The overlay doesn't need this — it polls the HTTP bridge (Task 01-b) for battle state.

---

### Step 9: Commit
```bash
git add .
git commit -m "feat: twitch integration — polls, eventsub, test mode stub"
```
