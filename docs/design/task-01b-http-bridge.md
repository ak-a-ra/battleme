# Task 01-b: HTTP Bridge for OBS Overlay

> **For AI:** Follow PLAN.md architecture. Insert this task after Task 05 / before Task 06.

**Goal:** Create a lightweight HTTP server in Rust that serves battle state JSON to the OBS overlay. The overlay runs in a plain browser (OBS Browser Source) which cannot use Tauri IPC.

**Architecture:** `tiny_http` runs on port 38021 in a background thread. It shares an `Arc<RwLock<BattleState>>` with the Tauri commands. The overlay polls `GET /api/battle-state` every 1s via `fetch()`.

**Tech Stack:** tiny_http, serde_json, Arc/RwLock, React fetch

---

### Step 1: Add tiny_http dependency

```toml
# src-tauri/Cargo.toml
[dependencies]
tiny_http = "0.12"
```

---

### Step 2: Create bridge module

```
src-tauri/src/bridge/
  mod.rs
```

---

### Step 3: Implement SharedBattleState and HTTP server

```rust
// src-tauri/src/bridge/mod.rs
use crate::battle::types::BattleState;
use std::sync::{Arc, RwLock};
use std::thread;

pub struct SharedBattleState {
    pub state: Arc<RwLock<BattleState>>,
}

pub fn start(state: Arc<RwLock<BattleState>>) {
    thread::spawn(move || {
        let server = tiny_http::Server::http("127.0.0.1:38021")
            .expect("Failed to start HTTP bridge on port 38021");
        for request in server.incoming_requests() {
            let url = request.url().to_string();
            let response = match url.as_str() {
                "/api/battle-state" => {
                    let s = state.read().unwrap();
                    let body = serde_json::to_string(&*s).unwrap_or_else(|_| "{}".to_string());
                    tiny_http::Response::from_string(body)
                        .with_header(
                            "Access-Control-Allow-Origin: *"
                                .parse::<tiny_http::Header>()
                                .unwrap(),
                        )
                        .with_header(
                            "Content-Type: application/json"
                                .parse::<tiny_http::Header>()
                                .unwrap(),
                        )
                }
                _ => tiny_http::Response::from_string("Not Found")
                    .with_status_code(404),
            };
            let _ = request.respond(response);
        }
    });
}
```

---

### Step 4: Wire into main.rs

Update `main.rs` to create the shared state and pass it everywhere:

```rust
// src-tauri/src/main.rs
mod bridge;
mod battle;
// ... other mods

use std::sync::{Arc, RwLock};
use battle::types::BattleState;

fn main() {
    let battle_state: Arc<RwLock<BattleState>> = Arc::new(RwLock::new(BattleState::default()));
    bridge::start(battle_state.clone());

    // AppState now includes battle_state
    // Pass battle_state.clone() to AppState as well
    // ...
}
```

---

### Step 5: Create overlay fetch polling hook

```ts
// src/hooks/useBattleState.ts
import { useState, useEffect } from 'react';
import type { BattleState } from '../lib/invoke';

const BRIDGE_URL = 'http://localhost:38021';

export function useBattleState() {
    const [state, setState] = useState<BattleState | null>(null);

    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch(`${BRIDGE_URL}/api/battle-state`);
                if (res.ok) {
                    setState(await res.json());
                }
            } catch {
                // Bridge not ready yet — ignore
            }
        };
        poll();
        const id = setInterval(poll, 1000);
        return () => clearInterval(id);
    }, []);

    return state;
}
```

---

### Step 6: Update AppState in main.rs

```rust
pub struct AppState {
    pub db: tokio::sync::Mutex<Connection>,
    pub battle_state: Arc<RwLock<BattleState>>,
}
```

Every command that mutates battle state must acquire the write lock:
```rust
let mut bs = state.battle_state.write().unwrap();
bs.turn_log.push(turn_result);
```

---

### Step 7: Verify

```bash
# Terminal 1: run the app
cargo tauri dev

# Terminal 2: curl the bridge
curl http://localhost:38021/api/battle-state
# Expected: JSON ({} or initial BattleState)
```

Also verify CORS works from the Vite dev server (port 3000):
```bash
curl -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  http://localhost:38021/api/battle-state
```

---

### Step 8: Commit

```bash
git add .
git commit -m "feat: HTTP bridge for OBS overlay — tiny_http server, shared battle state, fetch polling hook"
```
