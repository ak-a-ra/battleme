# BattleMe — Agent Guide

## Project Overview

**BattleMe** is a standalone Windows desktop app for Twitch streamers. Chat fights the streamer in turn-based monster battles via Twitch polls, displayed as an OBS overlay.

- **Stack:** Tauri v2 (Rust + React/TypeScript), SQLite, Tailwind, Lucide icons
- **Overlay:** OBS browser source at `localhost:38021/overlay` (HTTP bridge, no Tauri IPC)
- **Twitch:** EventSub WebSocket + polls (client credentials auth)
- **LLM:** Anthropic API for "Generate Stats" in admin panel
- **Platform:** Windows v1 only

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Tauri Window (Dashboard)                               │
│  React ── invoke() ──> Rust Backend                     │
│                          │                              │
│                          ├─ SQLite (rusqlite)           │
│                          ├─ Battle Engine (pure Rust)   │
│                          ├─ Twitch (auth/polls/eventsub)│
│                          └─ Arc<RwLock<BattleState>> ──┐│
                                                          │
┌──────────────────────────────────────────────────────────┘
│
▼  HTTP Bridge (tiny_http, port 38021)
│  GET /api/battle-state -> JSON (polled every 1s)
│  GET /overlay/* -> static files (prod)
│
┌─────────────────────────────────────────────────────────┐
│  OBS Browser Source (Overlay)                           │
│  React ── fetch() ──> Battle State                      │
│  1920x1080, 4-layer rendering system                    │
└─────────────────────────────────────────────────────────┘
```

**Key constraint:** OBS browser sources cannot use Tauri IPC. The overlay communicates solely via HTTP fetch polling from the Rust tiny_http bridge on port 38021.

## Directory Structure

```
battleme/
├── AGENTS.md              ← this file
├── INDEX.md               ← task index
├── PLAN.md                ← master implementation plan
├── README.md              ← quick start
├── docs/
│   ├── design/            ← task specs & design doc
│   │   ├── battleme-design.md
│   │   ├── task-01-scaffold.md
│   │   └── ...
│   └── adr/               ← architecture decision records
├── tmp/                   ← scratch/temp (gitignored)
├── scripts/               ← dev helper scripts
├── src/                   ← React frontend (created by task-01)
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   └── lib/
├── src-tauri/             ← Rust backend (created by task-01)
│   ├── src/
│   │   ├── db/
│   │   ├── commands/
│   │   ├── battle/
│   │   ├── twitch/
│   │   └── bridge/
│   └── ...
├── .env.example
├── .gitignore
├── package.json
└── vite.config.ts
```

## Build Order

Execute tasks strictly in order. Each depends on the previous.

| # | Task | Key Output | Depends on |
|---|------|-----------|------------|
| 01 | Scaffold | Project init, deps, folder structure | — |
| 02 | Database | SQLite schema, migrations, seed data | 01 |
| 03 | Commands | Tauri CRUD commands + typed invoke wrapper | 02 |
| 04 | Battle Engine | Pure Rust engine (types, damage, status, +tests) | 03 |
| 05 | Twitch | EventSub, polls, auth, test mode stub | 03 |
| 01-b | HTTP Bridge | tiny_http server, shared state, fetch polling hook | 04 |
| 06 | Admin UI | CRUD forms, LLM Generate Stats | 03 |
| 07 | Overlay Layers | 4-layer system, sprites, environment, animations | 01-b |
| 08 | Overlay UI | HP/MP bars, status icons, floating numbers, timer | 07 |
| 09 | Draft | Streamer lineup, 3-poll chat draft, RNG wildcard | 05 |
| 10 | Dashboard | Battle control, move selector, surrender, settings | 04, 01-b, 09 |

## Issue Log

See `ISSUES.md` for known environment limitations, workarounds, and bugs encountered during implementation.

## Dev Environment Rules

This project is developed on Termux (Android) which has constraints. Follow these rules:

### Rust
- **No `rustup`** — `cargo` available directly; don't install via rustup
- **Tauri binary won't link** — `ALooper_pollAll` undefined on Android; Tauri requires desktop GUI APIs
  - Verification: use `cargo check` + `cargo test --lib`, NOT `cargo run` or `cargo build --bin`
  - DB logic validated via file-backed tests, not by running the binary
- **Stale `.rlib` artifacts** (e.g. `libtest.rlib`) can leak into project root; add to `.gitignore` immediately

### TypeScript / Node
- **`tsc` not in PATH** — use `node node_modules/.bin/tsc` instead of bare `tsc`
- **Build:** `node node_modules/.bin/tsc && node node_modules/.bin/vite build`

### Testing Best Practices
- **All Rust modules with logic** must have `#[cfg(test)]` unit tests (in-memory DB for speed)
- **DB tests must include at least one file-backed test** to confirm migrations+seed work on real SQLite files, not just in-memory
- **Never rely on binary execution for verification** — use `cargo test --lib` and `cargo check`

### DB Path Convention
- Dev: `./battleme.db` (CWD fallback)
- Production: `app.path().app_data_dir()` — switch when Tauri app handle is available (task-03)

## Key Design Decisions

- **DB path:** Uses `app.path().app_data_dir()` (not CWD) for production stability
- **Async DB:** `tokio::sync::Mutex<Connection>` to avoid deadlocks across `.await` points
- **No shadcn/ui:** Raw Tailwind + Lucide icons to avoid interactive prompts
- **Sprite placeholders:** CSS-based colored rectangles + first letter (no file deps)
- **Poll result encoding:** Use `monsterId:abilityId` format in poll choice titles to avoid name collisions
- **Test mode:** When `TWITCH_CLIENT_ID` is empty, polls auto-resolve after duration

## Anti-Scope (v1)

Do NOT implement:
- Item & equipment system (loot boxes)
- Twitch Channel Points / Gift sub / Bits effects
- OAuth login (keep .env auth)
- Multi-Hunter switching
- Kick / YouTube adapters
- Public wiki hosting
- LUCK reward/drop system
- Mac / Linux builds

## Quality Standards

- **Every Rust module with logic** should have `#[cfg(test)]` unit tests
- **Commit after each task** with conventional commit message
- **Verification per task:** `cargo check`, `cargo test`, `npm run dev`, `curl localhost:38021/api/battle-state`
- **Document issues:** Update `ISSUES.md` when new workarounds or bugs are discovered
- **Sprite fallback** works without any image files — all overlay code testable in dev
