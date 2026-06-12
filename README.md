# BattleMe

Streamer-vs-chat monster battle for Twitch. Build a 3-monster lineup, chat votes via Twitch poll, and the battle plays out on an OBS overlay. Single Windows `.exe`, no server.

## Quick start

Prereqs: Rust, Node.js 18+, Tauri CLI.

```bash
cp .env.example .env   # fill Twitch client id/secret + Anthropic key
npm install
npm run tauri dev      # opens app on localhost:3000
```

## Stack

- Desktop shell: Tauri v2 (Rust backend + React frontend)
- Database: SQLite embedded via rusqlite
- Frontend: Vite + React + TypeScript + Tailwind
- Twitch: EventSub + client credentials
- Overlay: OBS browser source → `/overlay` at 1920x1080
- LLM: Anthropic API for “Generate Stats” in admin

## Roadmap

**v1 ✅ Complete.** Core battle loop, Twitch integration, OBS overlay, admin CRUD, draft system, dashboard controls.

Deferred to v2: Wiki encyclopedia, battle history replay, analytics stats, polish.

See `PLAN.md` for full detail.

## License

MIT — open source. See `LICENSE`.