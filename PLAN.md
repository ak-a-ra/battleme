# BattleMe — Master Implementation Plan

> Build order: task-01 → task-02 → task-03 → task-04 → task-05 → task-01b → task-06 → task-07 → task-08 → task-09 → task-10 → task-11 → task-12 → task-13. Each task feeds the next. Commit after each completes.
>
> **Critical architecture note:** The OBS overlay runs in a plain browser (no Tauri IPC). A Rust HTTP bridge (port 38021) serves battle state to the overlay via fetch polling. See Task 01-b.

---

## 1. Design Distill (The What & Why)

- Standalone Windows desktop app: Tauri v2 (Rust backend + React frontend). Single .exe, no server.
- Data: SQLite embedded via rusqlite, migrations + seed on first launch.
- Streamer vs Twitch chat monster battle: 3v3 + 1 Hunter per side. Chat votes moves via Twitch polls.
- Turn-based: AGI order, 80-120% damage variance, crit (150% base, Luck-scaling), type chart (6 types, 1.5/0.5 bars).
- Status: 9 effects (Burn, Poison intensifies +10%/tick, Freeze, Stun, Blind, Slow, Fear, Bleeding, Sleep). Max 1, re-apply resets duration.
- MP: chat monsters finite per battle; Hunter regen per turn (INT-scaled).
- Visual: OBS browser source at /overlay, 1920x1080, 4-layer system. Test mode for offline overlay setup.
- Platform: Twitch-first via EventSub + client credentials. Poll duration configurable per battle. On disconnect: auto-pause + overlay message.
- LLM: Anthropic once per monster on “Generate Stats”. Streamer edits before save.

---

## 2. Frontend & Routing

- Vite + React + TypeScript + Tailwind + Lucide on port 3000.
- Pages under src/pages:
  - /overlay     — OBS target
  - /dashboard   — streamer control (draft, battle, move pick, surrender, settings)
  - /wiki        — public companion:
    - /wiki/monsters, /wiki/monsters/:id
    - /wiki/hunters, /wiki/hunters/:id
    - /wiki/status-effects, /wiki/types
  - /admin       — CRUD for monsters/hunters/abilities/status + AP keys
    - /admin/monsters, /admin/hunters, /admin/abilities, /admin/status, /admin/settings
  - /history     — battle logs + turn replay
  - /stats       — analytics (win ratio, top monsters)
- Hook layer:
  - src/lib/invoke.ts — typed Tauri invoke wrapper
  - src/hooks/useBattleState.ts — HTTP polling from overlay bridge (used by overlay page)
  - src/hooks/useTwitchPoll.ts — listen('poll-result') (used by dashboard, Tauri window)
  - src/lib/stats.ts — client-side aggregation
  - src/lib/battleMachine.ts — Dashboard phase state machine

---

## 3. Rust Modules

Structure:
  src-tauri/src/
    db/         — models, migrations, seed, connection
    commands/   — monsters, hunters, abilities, status_effects, battle, settings, llm, twitch
    battle/     — engine, types, damage, status
    twitch/     — auth, polls, eventsub
    bridge/     — HTTP server for OBS overlay (shared battle state, REST endpoints)

Dependencies:
- rusqlite = { version = "0.31", features = ["bundled"] }
- serde = { version = "1", features = ["derive"] }, serde_json = "1"
- rand = "0.8"
- reqwest = { version = "0.12", features = ["json"] }
- tokio = { version = "1", features = ["full"] }
- dotenvy = "0.15"
- tiny_http = "0.12"

AppState:
  pub struct AppState { pub db: tokio::sync::Mutex<Connection>, pub battle_state: Arc<RwLock<BattleState>> }
  .manage(AppState { db: tokio::sync::Mutex::new(conn), battle_state: Arc::new(RwLock::new(BattleState::default())) }.invoke_handler(...)

---

## 4. Executable Task Plan

> **Status key:** ✅ Complete | 🔄 In progress | ⬜ Not started | ⛔ Blocked

| Task | Status | Commit | Notes |
|------|--------|--------|-------|
| 01 — Scaffold | ✅ | `d5901f6` | Deployed w/o `rustup` (cargo only); `tsc` via `node node_modules/.bin/tsc` |
| 02 — Database | ✅ | `4d0e919` | CWD path dev fallback; 2 unit tests for seed |
| 03 — Commands | ✅ | `40b3461` | 19 commands; AppState with tokio::sync::Mutex; Tauri v2 Result requirement; app_data_dir |
| 04 — Battle Engine | ✅ | `b31f1ed` | 4 modules, 19 unit tests, no DB dependency |
| 05 — Twitch | ✅ | `20baae6` | Auth, polls, EventSub WS, test mode stub, useTwitchPoll hook |
| 01-b — HTTP Bridge | ✅ | `530a375` | Shared state via Arc<RwLock<>>; fetch polling hook |
| 06 — Admin UI | ✅ | `f183f29` | CRUD pages, LLM generate stats, ability manager, settings |
| 07 — Overlay Layers | ⬜ | — | |
| 08 — Overlay UI | ⬜ | — | |
| 09 — Draft | ⬜ | — | |
| 10 — Dashboard | ⬜ | — | |
| 11 — Wiki | ⬜ | — | |
| 12 — History & Stats | ⬜ | — | |

---

## TASK 01 — Scaffold ✅

### Done
- `npm create tauri-app@latest` with react-ts template
- deps: tailwindcss, @tailwindcss/vite, lucide-react, react-router-dom
- All folder dirs + `.gitkeep` files
- `vite.config.ts` with `react()`, `tailwindcss()`, port 3000
- `src/main.tsx` with react-router stubs for all routes
- `src/App.tsx` nav layout with Outlet
- `.env.example` with 4 vars, `.gitignore` with `.env` + `target/`
- Git init + commit `d5901f6`

### Verified
- `src-tauri/cargo check` — clean
- `vite build` (via `node node_modules/.bin/tsc && node node_modules/.bin/vite build`) — 31 modules, 210KB JS
- Rust: serde + serde_json pre-loaded in Cargo.toml

### Note
- No `rustup` on this dev machine; `cargo` available directly
- `tsc` not in PATH; use `node node_modules/.bin/tsc`

---

## TASK 02 — DB Schema & Seed ✅

### Done
- `rusqlite` dep added to Cargo.toml (bundled feature)
- `src-tauri/src/db/models.rs` — 5 structs: Monster, Hunter, Ability, StatusEffect, BattleLog
- `src-tauri/src/db/migrations.rs` — 7 tables (status_effects first for FK ref, then monsters/hunters/abilities/join tables/battle_logs)
- `src-tauri/src/db/seed.rs` — `run_if_empty()` checks monster count before seeding
  - 9 status effects (Burn/Poison/Freeze/Stun/Blind/Slow/Fear/Bleeding/Sleep)
  - 12 monsters (2 per type: Fire/Water/Earth/Wind/Dark/Light)
  - 1 default hunter (Hunter, Fighter class)
- `src-tauri/src/db/mod.rs` — pub mod models, migrations, seed
- DB init in `lib.rs::run()` — `Connection::open("battleme.db")` + migrations + seed
- 2 unit tests in seed.rs: count verification + idempotency

### Verified
- `cargo check` — clean (5 dead_code warnings from unused models, expected)
- `cargo test --lib` — 3/3 pass (in-memory seed, idempotency, file-backed DB init with real SQLite file)
- `vite build` — clean

### Note
- DB path: `./battleme.db` (CWD dev fallback). Switched to `app_data_dir` in task-03 when AppState is introduced.
- File-backed test `test_file_backed_db_init` confirms migrations+seed work against a real on-disk SQLite file, not just in-memory.

---

## TASK 03 — Tauri Commands (CRUD + Settings)

## TASK 03 — Commands ✅

Commit: `40b3461`

### Summary
- AppState in lib.rs: `tokio::sync::Mutex<Connection>` + `Arc<RwLock<BattleState>>`
- 5 command submodules in `src-tauri/src/commands/`:
  - **monsters.rs**: get_monsters, create_monster, update_monster, delete_monster
  - **hunters.rs**: get_hunters, create_hunter, update_hunter, delete_hunter
  - **abilities.rs**: get_abilities_for_monster, create_ability, update_ability, delete_ability, assign_ability_to_monster
  - **status_effects.rs**: get_status_effects, create_status_effect, update_status_effect, delete_status_effect
  - **settings.rs**: get_settings (reads .env via dotenvy), save_settings (writes .env)
- All async commands with State return `Result<T, String>` (Tauri v2 requirement)
- DB path uses `app.path().app_data_dir()` via `.setup()` + `use tauri::Manager;`
- BattleState placeholder in battle/types.rs (expanded in task-04)
- `src/lib/invoke.ts` typed wrapper for all 19 commands

### Deps added
- tokio = { version = "1", features = ["full"] }
- dotenvy = "0.15"

### Verified
- `cargo check` — clean (1 pre-existing dead_code warning for BattleLog)
- `cargo test --lib` — 3/3 pass
- `vite build` — clean (31 modules, 210KB)

---

## TASK 04 — Battle Engine ✅

### Summary
- **battle/types.rs**: BattleMon, StatusState, TurnResult, AbilityInput, BattleState (with Default), type_multiplier fn
- **battle/damage.rs**: DamageResult, calculate() — stat-based, 80-120% variance, crit (DEX/LUCK scaling), physical miss, dodge
- **battle/status.rs**: tick() — Burn/Poison/Bleeding DoT, decrement/expire; apply() — Freeze/Slow mutual exclusion, no-stack
- **battle/engine.rs**: resolve_turn_order() — AGI + rng(0..2); resolve() — chain: status ticks → turn order → 2 attacks → KO/winner detection
- **commands/battle.rs**: resolve_turn command wiring engine to Tauri
- **19 unit tests** total (3 existing DB + 5 types + 3 damage + 5 status + 3 engine)
- **`commands/battle.rs`** — resolve_turn async command
- **`resolve_turn`** registered in lib.rs
- **`resolveTurn`** added to src/lib/invoke.ts

### Grilled decisions
1. AbilityInput → flattened value object (no DB ref) ✅
2. Status proc → 30% flat on hit ✅
3. Active mon → caller provides both sides ✅
4. Hunter → deferred ✅
5. resolve() → mutates BattleState in place ✅

### Verified
- `cargo check` — clean
- `cargo test --lib` — 19/19 pass
- `vite build` — clean

---

## TASK 05 — Twitch Integration ✅

Commit: `20baae6`

### Summary
- **twitch/auth.rs**: `get_app_token()` — client credentials flow via reqwest
- **twitch/polls.rs**: `create_poll()` — Helix API poll creation
- **twitch/eventsub.rs**: `listen()` — WebSocket EventSub via tokio-tungstenite; connects to `wss://eventsub.wss.twitch.tv/ws`, handles `session_welcome` → subscribes to `channel.poll.end` → emits `poll-result` on notification. Also handles `session_reconnect`, `session_keepalive`
- **commands/twitch.rs**: `start_poll` + `get_broadcaster_id` Tauri commands. Test mode when `TWITCH_CLIENT_ID` empty: sleeps duration then emits fake `poll-result` with first choice
- **hooks/useTwitchPoll.ts**: React listener for `poll-result` events
- Registered in `commands/mod.rs` + `lib.rs` invoke_handler
- Fixed flaky test in `engine.rs` (removed RNG-dependent winner assertion)

### Deps added
- reqwest = { version = "0.12", features = ["json"] }
- tokio-tungstenite = { version = "0.29", features = ["connect", "__rustls-tls"] }
- futures-util = "0.3"

### Verified
- `cargo check` — clean (1 pre-existing dead_code warning for BattleLog)
- `cargo test --lib` — 20/20 pass
- `vite build` — clean (31 modules, 210KB)
- `tsc --noEmit` — clean

---

## TASK 06 — Admin UI + LLM Generate Stats ✅

Commit: `f183f29`

### Summary
- **commands/llm.rs**: `generate_monster_stats(name, monster_type)` — Anthropic Claude API call, returns JSON with hp/mp/stats/lore/abilities/passives
- **commands/abilities.rs**: Added `unassign_ability_from_monster` (DELETE from join table)
- **AdminLayout.tsx**: Sidebar nav with 5 links (Monsters, Hunters, Abilities, Status, Settings) + `<Outlet />`
- **AdminMonsters.tsx**: Table view, Add/Edit/Delete, expandable row for per-monster AbilityManager
- **MonsterForm.tsx**: Modal form with all fields + "Generate Stats" button (fills stats/lore only — abilities discarded per grill decision)
- **AbilityManager.tsx**: Per-monster ability CRUD — active section + passive section, inline add/edit/delete forms
- **AdminHunters.tsx**: Table + modal form with 7 classes (no LLM generate)
- **AdminStatus.tsx**: Table + modal form with icon, effect, duration, color swatch
- **AdminSettings.tsx**: 4 env inputs (TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL_NAME, ANTHROPIC_API_KEY) + Copy OBS URL button
- **AdminAbilities.tsx**: Placeholder page redirecting to Monsters
- **lib/invoke.ts**: Added TypeScript interfaces (Monster, Hunter, Ability, StatusEffect) + typed API methods
- Registered `unassign_ability_from_monster` + `generate_monster_stats` in `lib.rs`

### Verified
- `cargo check` — clean (1 pre-existing dead_code warning for BattleLog)
- `cargo test --lib` — 20/20 pass
- `tsc --noEmit` — clean
- `vite build` — clean (42 modules, 234KB)

---

## TASK 01-b — HTTP Bridge for OBS Overlay ✅

Commit: `530a375`

Dep: tiny_http = "0.12"

New module: src-tauri/src/bridge/mod.rs

Shared state between Tauri commands and HTTP bridge:
```rust
pub struct SharedBattleState {
    pub state: Arc<RwLock<BattleState>>,
}

pub fn start(state: SharedBattleState) {
    std::thread::spawn(move || {
        let server = tiny_http::Server::http("127.0.0.1:38021").unwrap();
        for request in server.incoming_requests() {
            let url = request.url().to_string();
            let response = match url.as_str() {
                "/api/battle-state" => {
                    let s = state.state.read().unwrap();
                    let body = serde_json::to_string(&*s).unwrap();
                    tiny_http::Response::from_string(body)
                        .with_header("Access-Control-Allow-Origin: *".parse().unwrap())
                        .with_header("Content-Type: application/json".parse().unwrap())
                }
                _ => tiny_http::Response::from_string("Not Found".to_string())
                        .with_status_code(404),
            };
            request.respond(response).unwrap();
        }
    });
}
```

In main.rs:
  - mod bridge;
  - Create Arc<RwLock<BattleState>>, share with AppState and bridge::start()
  - Start HTTP bridge thread after app setup

Overlay React side (new hook):
  src/hooks/useBattleState.ts
  ```ts
  export function useBattleState() {
      const [state, setState] = useState<BattleState | null>(null)
      useEffect(() => {
          const poll = async () => {
              const res = await fetch('http://localhost:38021/api/battle-state')
              if (res.ok) setState(await res.json())
          }
          poll()
          const id = setInterval(poll, 1000)  // poll every 1s
          return () => clearInterval(id)
      }, [])
      return state
  }
  ```

OBS URLs:
  Dev: http://localhost:3000/overlay (Vite dev server, fetches from localhost:38021 via CORS)
  Prod: http://localhost:38021/overlay (embedded HTTP server serves static files)

Commit: "feat: HTTP bridge for OBS overlay — shared state server, fetch polling hook"

## TASK 06 — Admin UI + LLM Generate

Rust command:
  llm::generate_monster_stats(name, monster_type) -> Value
    read ANTHROPIC_API_KEY
    POST https://api.anthropic.com/v1/messages with headers x-api-key, anthropic-version: 2023-06-01
    prompt: return ONLY JSON with hp(50-200), mp(30-120), str/agi/dex/int(5-25), luck(5-20), abilities(4 active), passives(4), lore(1 sentence)
    extract content[0].text, parse JSON, return

Frontend:
  src/pages/admin/AdminLayout.tsx — sidebar nav, Outlet
  Monsters: table view, Add/Edit modal with fields (name/sprite_id/type/hp/mp/STR/AGI/DEX/INT/LUCK/lore)
    "Generate Stats" button -> calls generate_monster_stats -> fills form
    Save -> create/update
    AbilityManager per monster: 4 active + 4 passive slots with key bindings to ability CRUD
  Hunters: same CRUD pattern, no LLM
  Status: table with icon, name, effect, duration, color swatch
  Settings: 4 inputs, Save writes .env. "Copy OBS URL" button.

Commit: "feat: admin UI — CRUD, LLM generate stats"

---

## TASK 07 — OBS Overlay Layer System

src/pages/overlay/Overlay.tsx:
  <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', background: '#000' }}>
    <BackgroundLayer /><SpriteLayer /><EnvironmentLayer /><UILayer />
  </div>

src/pages/overlay/layers.ts (constants):
  Z.background = 1, sprites = 2, environment = 3, ui = 4, floaters = 5
  BATTLE_FLOOR_Y = 720

BackgroundLayer: absolute, inset 0, z Z.BACKGROUND, backgroundImage = src, cover center.

EnvironmentLayer: absolute inset 0 z Z.ENVIRONMENT
  Ground strip: absolute bottom 0 height 120 gradient transparent -> #2d4a1e
  Trees strip: absolute bottom 80 with CSS animation scroll-left 20s linear infinite background-repeat repeat-x
  @keyframes scroll-left { from { background-position-x: 0px; } to { background-position-x: -1920px; } }

Sprite.tsx:
  type SpriteState = 'idle' | 'attack' | 'damaged' | 'ko'
  stateOffsets: { idle:0, attack:1, damaged:2, ko:3 }
  Placeholder sprites (CSS-based, no file dependency):
    const PALETTE: Record<string, string> = {
      emberwolf: '#ff4400', flamecrow: '#ff8800',
      tidalfin: '#0088ff',  stormray: '#00ccff',
      stoneback: '#885522', mudcrawler: '#664422',
      galebird: '#88ddff',  driftfang: '#66bbcc',
      voidshade: '#442266', grimspawn: '#553377',
      dawnwing: '#ffdd44',  solarclaw: '#ffcc00',
    }
    Render colored rectangle with first letter of spriteId.
    Real pixel art can replace later without code changes.
  style:
    width 64, height 64, imageRendering pixelated
    filter: ko ? grayscale(100%) opacity(50%) : active ? drop-shadow(0 0 8px #fff) : none
    transform: flipX ? scaleX(-1) : none
    animation: idle ? sprite-idle 0.8s steps(4) infinite : undefined
  @keyframes sprite-idle { from { background-position-x: 0; } to { background-position-x: -256px; } }

SpriteLayer:
  Hunter sprite: left 80, top BATTLE_FLOOR_Y-64
  Streamer 3 monsters: left 180 + i*120
  Chat 3 monsters: right 80 + i*120, flipX
  KO state uses 'ko', active highlighted.

RunningScene.tsx:
  Hunter walk animation translateX(-100) -> translateX(2000) over 3s. Trees speed up. After 4s onComplete.

State wiring:
  useBattleState() polls http://localhost:38021/api/battle-state every 1s
  Overlay receives battle state updates via HTTP fetch (not Tauri IPC — OBS browser cannot use IPC)
  Draft team changes also reflected via battle state polling
  No listen() calls in overlay — all overlay data comes from HTTP bridge

Commit: "feat: overlay layer system — background, environment, sprites, running scene"

---

## TASK 08 — Overlay UI Layer (Layer 4)

MonsterHUD.tsx:
  Flex col gap 2, padding 4px 8px, bg rgba(0,0,0,0.7) rounded 6px, border 1px solid current highlight if active
  Row 1: name (monospace 12 bold) + TypeBadge
  Row 2: HP label + bar (6-8px track, colored green/yellow/red by pct, transition width 0.3s) + StatusIcon
  Row 3: MP label + blue bar (height 6) + m/m text

TypeBadge.tsx — colored border + background by type; Fire/Water/Earth/Wind/Dark/Light with inline icon.

StatusIcon.tsx — black translucent badge with icon + turns_left count.

TurnTimer.tsx — absolute top bar; height 6, bg #111, color by pct (>,60 green, >30 yellow, else red); transition width 1s linear.

FloatingNumbers.tsx:
  absolute positioned divs per Floater { id, text, x, y, isCrit, color }
  font 20-28px, text-shadow, pointer-events none, animation float-up 1.5s ease-out forwards
  @keyframes float-up { 0% { opacity 1; translateY 0; } 100% { opacity 0; translateY -80px; } }

Spawn from TurnResult:
  color: #fbbf24 if crit else #fff
  text: 'MISS' if 0, 'CRIT! N' if crit, 'N' normal
  also floater for status_inflicted: 'STATUS!' color #ff6b6b offset

UILayer:
  TurnTimer top strip
  Streamer HUDs: absolute left 20 bottom 140 flex row
  Chat HUDs: absolute right 20 bottom 140 flex row-reverse
  Center VS large text
  FloatingNumbers z Z.FLOATERS

Commit: "feat: overlay UI — HP/MP bars, status icons, floating numbers, timer"

---

## TASK 09 — Draft System

DB:
  CREATE streamer_lineup { id PK DEFAULT 1, hunter_id, slot1, slot2, slot3 REFERENCES monsters }

commands/battle.rs extras:
  save_streamer_lineup(state, hunter_id, monster_ids[0..2]) -> INSERT OR REPLACE into streamer_lineup
  get_streamer_lineup(state) -> include full hunter + monster stats

run_chat_draft:
  async command, phases:
  poll_1: 4 choices from remaining pool
  poll_2: 4 choices from remaining
  poll_3: 4 choices + (rng_wildcard ? extra random not in pool : 0)
  wait for poll-result event between phases
  emit 'draft-complete' { chat_team: ids } when done

Frontend:
  Dashboard lineup builder:
    monster pool grid, 3 card slots, hunter dropdown, Save Lineup button
  DraftPhase.tsx:
    shows live draft state per phase
  Overlay listens draft-complete -> stream's chat team renders

Commit: "feat: draft system — streamer lineup, 3-poll chat draft, RNG wildcard"

---

## TASK 10 — Dashboard — Battle Control

Battle state machine (battleMachine.ts):
  'idle' | 'draft' | 'turn_start' | 'poll_active' | 'resolving' | 'turn_end' | 'battle_over' | 'post_battle'

Dashboard.tsx:
  Left: start/surrender/throttle + phase badge + Copy OBS URL + Test Mode toggle
  Center: turn log + team summaries with current HP
  Right: per-round settings (poll duration, fallback: random|basic, rng wildcard checkbox)

Start flow:
  Save round settings, load lineup from DB, run_chat_draft -> 'draft-complete' -> turn_start -> start_poll (opens Twitch poll)

MoveSelector:
  4 active ability buttons (name, MP, power, type) + Basic Attack (0 MP)
  disabled if monster KO or locked MoveSelector state (monster selected is broadcasted)

Resolution on poll result:
  Get chosen ability from poll winner text map -> resolve_turn({ battleState, streamerMove, chatMove })
  Updated state -> write to Arc<RwLock<BattleState>> (shared with HTTP bridge) -> overlay picks it up on next poll -> check KO/winner/surrender -> log

End battle:
  invoke('end_battle', { winner: ... }) -> write to SharedBattleState -> overlay picks up via next fetch poll

Commit: "feat: dashboard — battle control, move selector, surrender, copy OBS URL, test mode"

---

## TASK 11 — Wiki

WikiLayout.tsx — top nav to Monsters/Hunters/Status/TypeChart

WikiMonsters.tsx:
  search input + 6 type toggle buttons
  4-col grid of MonsterCards (sprite, name, TypeBadge, hp/mp line)
  route to /wiki/monsters/:id

WikiMonsterDetail.tsx:
  Header 128px sprite, name, TypeBadge, italic lore
  StatBars: str/agi/dex/int/luck scaled max 25
  Abilities table: active (name/mp/power/type/effect/status) + passive (name/effect)
  "Generated" badge if generated_by_llm

StatBars.tsx:
  map STATS = [str_stat, agi, dex, int_stat, luck], bar width % of 25, blue

WikiHunters + WikiHunterDetail same pattern; extra Hunter class + ultimate description.

WikiStatusEffects.tsx:
  table icon | colored badge name | effect_per_turn | duration

WikiTypeChart.tsx:
  6x6 grid of cells; 1.5 green, 1.0 white, 0.5 red. Labels attacker (row) vs defender (col).

Router: add /wiki and nested paths.

Commit: "feat: wiki — companion encyclopedia, status reference, type chart"

---

## TASK 12 — History & Stats

commands/battle.rs:
  get_battle_logs(state) -> Vec<BattleLog> SELECT * ORDER BY date DESC LIMIT 50
  get_battle_log(state, id) -> Option<BattleLog>
  save_battle_result(state, winner_side, streamer_team, chat_team, turns, duration_secs):
    INSERT INTO battle_logs (date, winner_side, streamer_team, chat_team, turns, duration_secs)
    VALUES (datetime('now'), ?, ?, ?, ?, ?)

History.tsx:
  list rows: date, winner badge (streamer|chat color), 3 thumb sprites each, duration
  click -> /history/:id

HistoryDetail.tsx:
  turn timeline:
    TurnEntry: turn index, streamer move + damage + CRIT flag + status + post-HP, chat move + same
  Layout with left border indicator for each turn

Stats.tsx (recharts):
  computeStats(logs) { total, streamerWins, chatWins, topMonsters = countBy(flatten teams) top 5 }
  PieChart: streamer vs chat wins
  BarChart: top 5 most picked monsters
  Summary: "N battles played, avg Xm Ys"

Commit: "feat: battle history replay + analytics stats"

---

## 5. Non-Functional & Env

- .env at app root; never committed.
- OBS URL (dev): http://localhost:3000/overlay — Vite dev server, fetches bridge on port 38021 via CORS.
- OBS URL (prod): http://localhost:38021/overlay — embedded tiny_http serves overlay static files directly.
- Dashboard Copy button copies the appropriate URL depending on dev/prod mode.
- Poll duration default: 30s; streamer sets per battle in RoundSettings.
- Test mode: if TWITCH_CLIENT_ID empty, start_poll sleeps then emits fake result; overlay renders normally.
- Windows-only v1. No Mac/Linux builds until post-v1.

---

## 6. Anti-Scope / Defer

Do NOT implement in v1:
- Item & equipment system (loot box drops, RNG Diablo-style stats)
- Twitch Channel Points / Gift sub / Sub / Bits effects
- OAuth login (replace .env auth)
- Multi-Hunter switching (1 Hunter template only)
- Kick / YouTube adapters
- Public wiki hosting
- LUCK reward/drop system
- Mac / Linux builds

---

## 7. File Inventory (Target Final State)

Root
  AGENTS.md              — project context for AI agents
  INDEX.md               — task index
  PLAN.md                — master implementation plan
  README.md              — quick start
  .env.example
  .gitignore
  Cargo.toml
  package.json, vite.config.ts, tsconfig.json
  
Meta
  docs/
    design/
      battleme-design.md  — design snapshot
      task-01-scaffold.md ... task-13-polish.md
    adr/                  — architecture decision records
  scripts/                — dev helper scripts
  tmp/                    — scratch/temp (gitignored)

Rust backend (src-tauri/)
  src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/src/main.rs
  src-tauri/src/bridge/mod.rs
  src-tauri/src/db/{mod,models,migrations,seed}.rs
  src-tauri/src/commands/{monsters,hunters,abilities,status_effects,battle,settings,llm,twitch}.rs
  src-tauri/src/battle/{mod,types,damage,status,engine}.rs
  src-tauri/src/twitch/{mod,auth,polls,eventsub}.rs

React frontend (src/)
  src/main.tsx, src/App.tsx
  src/lib/{invoke,stats,battleMachine}.ts
  src/hooks/useBattleState.ts
  src/hooks/useTwitchPoll.ts
  src/pages/overlay/{Overlay,BackgroundLayer,EnvironmentLayer,Sprite,SpriteLayer,RunningScene,UILayer,MonsterHUD,TypeBadge,StatusIcon,FloatingNumbers,TurnTimer,layers,overlay}.tsx css
  src/pages/dashboard/{Dashboard,LineupBuilder,DraftPhase,MoveSelector,RoundSettings}.tsx
  src/pages/wiki/{WikiLayout,WikiMonsters,WikiMonsterDetail,WikiHunters,WikiHunterDetail,WikiStatusEffects,WikiTypeChart,StatBars,TypeBadge}.tsx
  src/pages/admin/{AdminLayout,AdminMonsters,MonsterForm,AbilityManager,AdminHunters,AdminStatus,AdminSettings}.tsx
  src/pages/history/{History,HistoryDetail,TurnEntry}.tsx
  src/pages/stats/Stats.tsx

---

## 8. Verification Checklist

After each task:
  cargo check in src-tauri
  cargo test         # unit tests for battle engine + any other #[cfg(test)]
  npm run dev works, overlay at /overlay loads in browser
  sqlite3 battleme.db verified: 12 monsters, 1 hunter, 9 status effects
  curl http://localhost:38021/api/battle-state returns JSON (after Task 01-b)
  Test mode: poll cycles and overlay animates without Twitch creds

## 9. Issue Log

See `ISSUES.md` for known environment limitations and workarounds (especially Termux-specific constraints).
Update `ISSUES.md` whenever a new issue or workaround is discovered during implementation.