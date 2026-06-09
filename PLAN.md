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

## TASK 01 — Scaffold (foundation, depends on nothing)

Install:
  rustup --version      # expect rustc + cargo
  node --version        # expect 18+
  cargo install tauri-cli --version "^2.0"
  npm create tauri-app@latest battleme -- --template react-ts
  cd battleme && npm install
  npm install tailwindcss @tailwindcss/vite lucide-react react-router-dom
  # No shadcn/ui — use raw Tailwind + Lucide to avoid interactive prompts

Folders:
  src/pages/{overlay,dashboard,wiki,admin,history,stats}
  src/components/{battle,ui}
  src/hooks, src/lib
  src-tauri/src/{commands,db,battle,twitch}
  touch .gitkeep in each

vite.config.ts:
  plugins: [react(), tailwindcss()]
  server.port: 3000

src/main.tsx stub:
  BrowserRouter with routes for /overlay /dashboard /wiki/* /admin/* /history/* /stats

Env:
  .env.example with TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL_NAME, ANTHROPIC_API_KEY
  gitignore add .env and target/

Commit:
  git init; git add.; git commit -m "feat: initial BattleMe scaffold"

---

## TASK 02 — DB Schema & Seed

Cargo.toml dep:
  rusqlite = { version = "0.31", features = ["bundled"] }
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"

src-tauri/src/db/models.rs:
  pub struct Monster { id, name, sprite_id: String, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck, lore, generated_by_llm }
  pub struct Hunter  { id, name, sprite_id, class, hp, mp, str_stat, agi, dex, int_stat, luck, lore }
  pub struct Ability { id, name, mp_cost, power, ability_type, effect, status_inflict_id: Option<i64>, is_passive }
  pub struct StatusEffect { id, name, icon, effect_per_turn, duration, visual_color }
  pub struct BattleLog { id, date, winner_side, streamer_team: String, chat_team: String, turns: String, duration_secs }
  derive Serialize + Deserialize for all.

src-tauri/src/db/migrations.rs:
  CREATE monsters (id PK AI, name, sprite_id, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck, lore DEFAULT '', generated_by_llm INTEGER DEFAULT 0)
  CREATE hunters  (...) same columns as design
  CREATE abilities (id PK AI, name, mp_cost DEFAULT 0, power DEFAULT 0, ability_type, effect DEFAULT '', status_inflict_id -> status_effects(id), is_passive DEFAULT 0)
  CREATE monster_abilities (monster_id -> monsters, ability_id -> abilities, PK(monster_id, ability_id))
  CREATE hunter_abilities  (hunter_id -> hunters, ability_id -> abilities, PK(hunter_id, ability_id))
  CREATE status_effects (id PK AI, name UNIQUE, icon, effect_per_turn DEFAULT '', duration DEFAULT 3, visual_color DEFAULT '#ffffff')
  CREATE battle_logs (id PK AI, date NOT NULL, winner_side NOT NULL, streamer_team NOT NULL, chat_team NOT NULL, turns DEFAULT '[]', duration_secs DEFAULT 0)

src-tauri/src/db/seed.rs — run_if_empty:
  seed_status_effects (9 rows: Burn/Poison/Freeze/Stun/Blind/Slow/Fear/Bleeding/Sleep)
  seed_monsters (2 per type: Fire, Water, Earth, Wind, Dark, Light — 12 total)
  seed_default_hunter (1 row: Hunter, fighter, balanced stats)

src-tauri/src/main.rs:
  mod db;
  // Use Tauri's path resolver for stable DB location (not CWD)
  let app = tauri::Builder::default().build(tauri::generate_context!()).unwrap();
  let app_data = app.path().app_data_dir().unwrap();
  std::fs::create_dir_all(&app_data).unwrap();
  let db_path = app_data.join("battleme.db");
  let conn = Connection::open(db_path).unwrap();
  db::migrations::run(&conn);
  db::seed::run_if_empty(&conn);
  tauri::Builder::default().run(tauri::generate_context!()).unwrap();

Commit: "feat: db schema, migrations, seed data"

---

## TASK 03 — Tauri Commands (CRUD + Settings)

AppState in main.rs:
  use tokio::sync::Mutex;            // tokio::sync::Mutex for async safety
  use std::sync::{Arc, RwLock};
  pub struct AppState {
    pub db: tokio::sync::Mutex<Connection>,
    pub battle_state: Arc<RwLock<BattleState>>,  // shared with HTTP bridge
  }

commands/monsters.rs:
  #[tauri::command] get_monsters(state) -> Vec<Monster>
  create_monster(state, monster) -> i64
  update_monster(state, monster)
  delete_monster(state, id)

commands/abilities.rs:
  get_abilities_for_monster(monster_id)
  create_ability / update_ability / delete_ability
  assign_ability_to_monster(monster_id, ability_id)

commands/hunters.rs: same CRUD pattern.

commands/status_effects.rs: same CRUD pattern.

commands/settings.rs:
  get_settings() -> HashMap<String,String>
    dotenvy::dotenv().ok(); read TWITCH_CLIENT_ID, TWITCH_CHANNEL_NAME, ANTHROPIC_API_KEY
  save_settings(settings) -> write key=value lines to .env

Register all in main.rs with tauri::generate_handler![].

src/lib/invoke.ts (typed wrapper):
  import { invoke } from '@tauri-apps/api/core'
  export const api = {
    getMonsters: () => invoke('get_monsters'),
    createMonster: (m) => invoke('create_monster', { monster: m }),
    updateMonster: (m) => invoke('update_monster', { monster: m }),
    deleteMonster: (id) => invoke('delete_monster', { id }),
    getHunters: () => invoke('get_hunters'),
    getStatusEffects: () => invoke('get_status_effects'),
    getSettings: () => invoke('get_settings'),
    saveSettings: (s) => invoke('save_settings', { settings: s }),
  }

Commit: "feat: tauri commands for all CRUD operations"

---

## TASK 04 — Battle Engine (pure Rust, no Tauri Depend)

Dep: rand = "0.8"
Structure: src-tauri/src/battle/{mod,types,damage,status,engine}.rs

src-tauri/src/battle/types.rs:
  struct BattleMon { id, name, monster_type, hp, max_hp, mp, max_mp, str_stat, agi, dex, int_stat, luck, active_status: Option<StatusState>, is_ko }
  struct StatusState { name, turns_left, intensity }
  struct TurnResult { attacker_side, attacker_name, ability_used, damage_dealt, is_crit, status_inflicted: Option<String>, target_hp_after, target_ko, float_text }
  struct BattleState { streamer_team, chat_team, turn_number, winner: Option<String>, turn_log: Vec<TurnResult> }

src-tauri/src/battle/types.rs — type_multiplier(attacker, defender) -> f64:
  (Fire, Earth|Wind) => 1.5;  (Water, Fire|Earth) => 1.5;  (Earth, Water) => 1.5;  (Wind, Water|Earth) => 1.5
  (Dark, Light)|(Light, Dark) => 1.5
  (Fire, Water) => 0.5; (Water, Wind) => 0.5; (Earth, Fire|Wind) => 0.5; (Wind, Fire) => 0.5
  (Dark, Dark)|(Light, Light) => 0.5
  _ => 1.0

src-tauri/src/battle/damage.rs — calculate(attacker, defender, base_power, ability_type, type_multiplier):
  rng.gen_range(0.80..=1.20) variance
  stat = int if magic else str
  crit_chance = dex / 200.0 (cap 0.95), crit_mult = 1.5 + luck * 0.005
  physical hit_chance = (dex / 100.0).min(0.99); magic = 1.0
  dodge_chance = (defender.agi / 300.0).min(0.40)
  miss/dodge -> 0 dmg
  raw = (base_power + stat) * variance * crit_mult * type_multiplier
  return DamageResult { damage: round(raw), is_crit }

src-tauri/src/battle/status.rs:
  tick(mon) -> i64
    Burn: 5 + max_hp/20
    Poison: base + base * intensity/10; intensity += 1 on apply
    Bleeding: max_hp/10
    others: 0
    decrement turns_left, clear if 0
  apply(mon, status_name, duration)
    Freeze <-> Slow mutually exclusive (replace); others no-stack; others = identity
    set active_status (intensity = 0)

src-tauri/src/battle/engine.rs:
  resolve_turn_order(a, b): a.agi + rng 0..2 vs b.agi + rng 0..2; higher first. Returns (streamer, chat) or (chat, streamer).
  Full turn resolution logic applies status ticks, status infliction on hit, damage calc, KO checks, winner detection.

Separate commands/battle.rs file invoke from React, calling battle:: functions.

### Unit tests (add after implementing each module)
Add `#[cfg(test)]` modules in types.rs, damage.rs, status.rs, engine.rs:
- type_multiplier: Fire→Earth=1.5, Dark→Dark=0.5, Fire→Light=1.0
- damage calc: miss returns 0, dodge returns 0, crit sets is_crit=true
- status tick: Burn reduces HP, Poison intensity increments, status expires at 0 turns
- turn order: higher AGI goes first (wrap in deterministic test using seeded RNG)

### Verification
```bash
cargo test          # all #[cfg(test)] pass
```

Commit: "feat: battle engine — damage calc, type chart, status effects, turn order, unit tests"

---

## TASK 05 — Twitch Integration

Dep: reqwest = { version = "0.12", features = ["json"] }, tokio = { version = "1", features = ["full"] }

src-tauri/src/twitch/auth.rs:
  get_app_token(client_id, client_secret) -> String
    POST https://id.twitch.tv/oauth2/token with client_id, client_secret, grant_type=client_credentials

src-tauri/src/twitch/polls.rs:
  create_poll(client_id, token, broadcaster_id, title, choices: Vec<&str>, duration_secs) -> String  (returns poll id)

src-tauri/src/twitch/eventsub.rs (async):
  listen(app_handle, token, client_id, broadcaster_id) -> async WebSocket to wss://eventsub.wss.twitch.tv/ws
  1. Connect WebSocket → receive session_welcome → get session_id
  2. POST /helix/eventsub/subscriptions with:
     {
       "type": "channel.poll.end",
       "version": "1",
       "condition": { "broadcaster_user_id": "..." },
       "transport": { "method": "websocket", "session_id": "..." }
     }
  3. On poll.end notification: app_handle.emit("poll-result", winning_choice)

src-tauri/src/commands/twitch.rs:
  start_poll(state, app, title, choices, duration_secs) -> String
    read .env, broadcast GET /helix/users?login=CHANNEL_NAME for broadcaster_id
    token = get_app_token
    create poll
    if TWITCH_CLIENT_ID empty -> test mode: sleep duration then app.emit("poll-result", choices[0])  // basic attack fallback
    return poll_id
  get_broadcaster_id(state) -> String
  Note: use tokio::sync::Mutex for DB — release lock before .await points to avoid deadlock

src/hooks/useTwitchPoll.ts:
  useEffect -> listen('poll-result') -> setResult(e.payload). Cleanup unlisten.

Commit: "feat: twitch integration — polls, eventsub subscription, test mode stub"

---

## TASK 01-b — HTTP Bridge for OBS Overlay (insert before task 06/07)

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
  cargo build --release
  npm run dev works, overlay at /overlay loads in browser
  sqlite3 battleme.db verified: 12 monsters, 1 hunter, 9 status effects
  curl http://localhost:38021/api/battle-state returns JSON (after Task 01-b)
  Test mode: poll cycles and overlay animates without Twitch creds