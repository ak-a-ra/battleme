# BattleMe — Implementation Plan Index

> Feed each task file to Claude Code one at a time. Task files live in `docs/design/`. Complete in order — each task builds on the previous.

---

## Quick Reference

```
AGENTS.md              ← project context for AI agents
PLAN.md                ← master implementation plan
ISSUES.md              ← known issues & workarounds
docs/design/           ← task specs (01–13)
docs/adr/              ← architecture decision records
tmp/                   ← scratch/temp (gitignored)
```

---

## Task List

| # | File | Goal | Depends on | Status |
|---|---|---|---|---|---|
| 01 | `docs/design/task-01-scaffold.md` | Tauri + React project init, folder structure, .env template | — | ✅ |
| 02 | `docs/design/task-02-database.md` | SQLite schema, migrations, seed 12 monsters + 9 status effects | 01 | ✅ |
| 03 | `docs/design/task-03-commands.md` | Tauri invoke commands for all CRUD + settings | 02 | ✅ |
| 04 | `docs/design/task-04-battle-engine.md` | Rust battle engine — damage calc, type chart, status (+ tests) | 03 | ✅ |
| 05 | `docs/design/task-05-twitch.md` | Twitch integration — auth, polls, EventSub, test mode stub | 03 | ✅ |
| 01-b | `docs/design/task-01b-http-bridge.md` | HTTP bridge for OBS overlay — shared state, REST endpoints | 04 | ✅ |
| 06 | `docs/design/task-06-admin-ui.md` | Admin UI — CRUD forms, LLM Generate Stats button | 03 | ✅ |
| 07 | `docs/design/task-07-overlay-layers.md` | OBS overlay 4-layer system, sprite animations, parallax | 01-b | ⬜ |
| 08 | `docs/design/task-08-overlay-ui.md` | Overlay UI — HP/MP bars, status icons, floating numbers, timer | 07 | ⬜ |
| 09 | `docs/design/task-09-draft.md` | Draft system — streamer lineup + chat 3-poll draft + RNG wildcard | 05 | ⬜ |
| 10 | `docs/design/task-10-dashboard.md` | Streamer dashboard — battle control, move selector, surrender | 04, 01-b, 09 | ⬜ |
| 11 | `docs/design/task-11-wiki.md` | Wiki — monster/hunter encyclopedia, status effects, type chart | 03 | ⬜ |
| 12 | `docs/design/task-12-history-stats.md` | Battle history turn replay + analytics stats page | 10 | ⬜ |
| 13 | `docs/design/task-13-polish.md` | Sound effects, auto-updater, Twitch disconnect recovery, Windows build | all | ⬜ |

---

## How to use with Claude Code

```
1. Open Claude Code in the battleme/ project directory
2. Feed task-01-scaffold.md → complete all steps → commit
3. Feed task-02-database.md → complete → commit
4. Continue in order through task-13
5. Each task is self-contained — if a step fails, fix before moving on
```

---

## Post-v1 Backlog (do NOT implement now)

- Item & equipment system (loot box drops, RNG stats)
- Twitch Channel Points redeems
- Gift sub / sub / bits effects
- OAuth login (replace .env Twitch auth)
- Multi-Hunter switching
- Kick / YouTube platform adapters
- Public wiki hosting
- LUCK reward/drop system
- Mac / Linux builds

---

## Key Design Decisions (reference)

- **Binary:** Single `.exe`, no install required
- **DB:** SQLite embedded via `rusqlite`
- **Overlay:** OBS browser source → port 38021 HTTP bridge (polled via fetch every 1s). Dev: `localhost:3000/overlay`, Prod: `localhost:38021/overlay`
- **OBS vs IPC:** OBS browser sources cannot use Tauri IPC. A `tiny_http` server in Rust serves battle state JSON at `/api/battle-state`. The overlay polls this endpoint.
- **Twitch auth:** `.env` file, client credentials flow
- **LLM:** Anthropic API, runs once per monster on "Generate Stats"
- **Poll duration:** Configurable per battle, default 30s
- **Damage:** 80-120% variance, 150% base crit, LUCK scales crit mult
- **Type no-match:** 1.0x neutral damage
- **Poison intensity:** +10% base damage per tick
- **Monster pool:** 12 default (2 per type), expandable via admin
- **Team size:** 3 monsters per side + 1 Hunter (streamer only)
- **Abilities:** 4 active + 4 passive per monster
- **Status:** 9 effects, no stacking, re-apply resets duration
