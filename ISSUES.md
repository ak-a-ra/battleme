# Issue Log

Known environment limitations, workarounds, and bugs encountered during implementation.

---

## Environment: Termux (Android)

### 1. No `rustup` available
- **Issue:** `rustup` not installed; only `cargo` available directly.
- **Workaround:** Don't install `rustup`. Use `cargo` for all Rust operations (check, test, build).
- **Affects:** task-01, task-02

### 2. `tsc` not in PATH
- **Issue:** Running `tsc` directly fails. Node's `node_modules/.bin/` not in PATH.
- **Workaround:** Use `node node_modules/.bin/tsc` instead of bare `tsc`.
- **Build command:** `node node_modules/.bin/tsc && node node_modules/.bin/vite build`
- **Affects:** task-01, all frontend builds

### 3. Tauri binary won't link on Termux
- **Issue:** `ALooper_pollAll` undefined symbol — Android lacks GUI APIs Tauri requires.
  ```
  ld.lld: error: undefined symbol: ALooper_pollAll
  >>> referenced by looper.rs:172 (src/looper.rs:172)
  >>>               ndk-....rcgu.o:(ndk::looper::ThreadLooper::poll_all_ms...)
  ```
- **Workaround:** Never run `cargo run` or `cargo build --bin`. Use `cargo check` + `cargo test --lib` for verification.
- **DB testing:** Validate SQLite logic via file-backed unit tests (`Connection::open` on real file path, then assert row counts).
- **Entry:** `ec7db67`
- **Affects:** all tasks

### 4. Stray `libtest.rlib` artifacts
- **Issue:** Rust compiler can leave `.rlib` files in project root (e.g. `libtest.rlib`).
- **Workaround:** Add `libtest.rlib` to `.gitignore`. Remove before staging.
- **Affects:** task-02

---

## Implementation Gotchas

### 5. Tauri v2: async commands with `State` must return `Result<T, String>`
- **Issue:** `#[tauri::command] pub async fn` that takes `tauri::State<'_, AppState>` as input must return `Result<T, String>`. Sync commands (no State, or sync fn with State) can return bare values. This is a Tauri v2 safety constraint — async commands with references must return a `Result`.
  ```
  error: async commands that contain references as inputs must return a `Result`
  ```
- **Workaround:** Return `Result<Vec<Monster>, String>`, `Result<i64, String>`, or `Result<(), String>`. Use `.map_err(|e| e.to_string())?` instead of `.expect()` in async commands with State.
- **Affects:** task-03 onwards (all async commands taking AppState)

## Resolved Bugs

### DB init path: CWD vs `app_data_dir`
- **Issue:** Task spec showed `app.path().app_data_dir()` for DB path, but this requires Tauri app handle which isn't available during `lib.rs::run()` without wiring AppState.
- **Resolution:** Use `./battleme.db` (CWD fallback) for dev. Switch to `app_data_dir()` in task-03 when AppState + Tauri path resolver are introduced.
- **Entry:** resolved in `4d0e919`

---

## New entries template

```markdown
### Title
- **Issue:** description
- **Workaround:** what to do
- **Affects:** which tasks
```
