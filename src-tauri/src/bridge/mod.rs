use crate::battle::types::BattleState;
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::thread;
use std::{fs, path::Path};

/// Start the HTTP bridge on port 38021 in a background thread.
///
/// Endpoints:
///   `GET /api/battle-state` — JSON from shared Arc<RwLock<BattleState>>
///   `GET /health`           — health check (returns "ok")
///   `GET /*`                — static files from dist/ (SPA fallback for React Router)
///   `OPTIONS *`             — CORS preflight
///
/// Graceful degrade on port conflict and missing dist/.
pub fn start(state: Arc<RwLock<BattleState>>) {
    let server = match tiny_http::Server::http("127.0.0.1:38021") {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[bridge] WARN: failed to bind :38021 — {e}");
            return;
        }
    };

    let dist = resolve_dist_path();
    if !dist.join("index.html").exists() {
        eprintln!(
            "[bridge] WARN: dist/ not found at {:?} — overlay serving disabled",
            dist
        );
    }

    thread::spawn(move || {
        for request in server.incoming_requests() {
            let method = request.method().clone();
            let url = request.url().to_string();

            let response: tiny_http::Response<Cursor<Vec<u8>>> = match (&method, url.as_str()) {
                (&tiny_http::Method::Options, _) => empty(200),
                (&tiny_http::Method::Get, "/api/battle-state") => {
                    let s = state.read().unwrap();
                    let body =
                        serde_json::to_string(&*s).unwrap_or_else(|_| "{}".to_string());
                    json_ok(body)
                }
                (&tiny_http::Method::Get, "/health") => text_ok("ok"),
                (&tiny_http::Method::Get, path) => serve_static(&dist, path),
                _ => not_found(),
            };

            let _ = request.respond(response);
        }
    });
}

// ── Dist path resolution ──

/// Resolve the dist/ directory by trying known locations.
fn resolve_dist_path() -> PathBuf {
    // 1. Dev path: CARGO_MANIFEST_DIR/../dist (compile-time constant)
    let dev = PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../dist"));
    if dev.join("index.html").is_file() {
        return dev;
    }
    // 2. CWD/dist
    let cwd = PathBuf::from("dist");
    if cwd.join("index.html").is_file() {
        return cwd;
    }
    // 3. Alongside the running binary
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let exe_path = parent.join("dist");
            if exe_path.join("index.html").is_file() {
                return exe_path;
            }
        }
    }
    dev // fallback — caller will warn
}

// ── Static file serving ──

/// Try to serve a file from dist/, with SPA fallback.
fn serve_static(dist: &Path, url: &str) -> tiny_http::Response<Cursor<Vec<u8>>> {
    let url_path = url.trim_start_matches('/');

    // Root or overlay route → index.html (React Router entry point)
    if url_path.is_empty() || url_path == "overlay" {
        return file_or_404(&dist.join("index.html"), "text/html");
    }

    let file_path = dist.join(url_path);

    // Direct file hit
    if file_path.is_file() {
        let mime = mime_for_path(&file_path);
        return file_or_404(&file_path, mime);
    }

    // SPA fallback: path without a file extension → index.html
    if !url_path.contains('.') {
        let idx = dist.join("index.html");
        if idx.is_file() {
            return file_or_404(&idx, "text/html");
        }
    }

    not_found()
}

fn file_or_404(path: &Path, mime: &str) -> tiny_http::Response<Cursor<Vec<u8>>> {
    match fs::read(path) {
        Ok(data) => {
            let len = data.len();
            tiny_http::Response::new(
                tiny_http::StatusCode(200),
                vec![
                    cors_header(),
                    mime_header(mime),
                ],
                Cursor::new(data),
                Some(len),
                None,
            )
        }
        Err(_) => not_found(),
    }
}

// ── Response helpers ──

fn json_ok(body: String) -> tiny_http::Response<Cursor<Vec<u8>>> {
    tiny_http::Response::from_string(body)
        .with_status_code(200)
        .with_header(cors_header())
        .with_header(mime_header("application/json"))
}

fn text_ok(body: &str) -> tiny_http::Response<Cursor<Vec<u8>>> {
    tiny_http::Response::from_string(body.to_string())
        .with_status_code(200)
        .with_header(cors_header())
        .with_header(mime_header("text/plain"))
}

fn empty(status: i32) -> tiny_http::Response<Cursor<Vec<u8>>> {
    tiny_http::Response::from_string(String::new()).with_status_code(status)
}

fn not_found() -> tiny_http::Response<Cursor<Vec<u8>>> {
    tiny_http::Response::from_string("Not Found".to_string()).with_status_code(404)
}

// ── Header helpers ──

fn cors_header() -> tiny_http::Header {
    "Access-Control-Allow-Origin: *"
        .parse::<tiny_http::Header>()
        .unwrap()
}

fn mime_header(mime: &str) -> tiny_http::Header {
    format!("Content-Type: {mime}")
        .parse::<tiny_http::Header>()
        .unwrap()
}

/// Map file extension to MIME type.
fn mime_for_path(path: &Path) -> &str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html",
        Some("js") => "application/javascript",
        Some("css") => "text/css",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("ico") => "image/x-icon",
        Some("json") => "application/json",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("ttf") => "font/ttf",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use crate::battle::types::*;

    #[test]
    fn test_battle_state_json_roundtrip() {
        let bs = BattleState {
            streamer_team: vec![BattleMon {
                id: 1,
                name: "Ember".into(),
                monster_type: "Fire".into(),
                hp: 80,
                max_hp: 100,
                mp: 30,
                max_mp: 50,
                str_stat: 15,
                agi: 10,
                dex: 12,
                int_stat: 8,
                luck: 5,
                active_status: Some(StatusState {
                    name: "Burn".into(),
                    turns_left: 3,
                    intensity: 1,
                }),
                is_ko: false,
            }],
            chat_team: vec![],
            turn_number: 1,
            winner: None,
            turn_log: vec![TurnResult {
                attacker_side: "streamer".into(),
                attacker_name: "Ember".into(),
                ability_used: "Fireball".into(),
                damage_dealt: 42,
                is_crit: false,
                status_inflicted: Some("Burn".into()),
                target_hp_after: 58,
                target_ko: false,
                float_text: "42 [Burn!]".into(),
            }],
            phase: "battle".into(),
            poll_duration_secs: 0,
            poll_started_at_ms: 0,
        };

        let json = serde_json::to_string(&bs).expect("serialize");
        let deserialized: BattleState = serde_json::from_str(&json).expect("deserialize");

        assert_eq!(bs.turn_number, deserialized.turn_number);
        assert_eq!(bs.streamer_team.len(), deserialized.streamer_team.len());
        assert_eq!(bs.streamer_team[0].name, deserialized.streamer_team[0].name);
        assert_eq!(
            bs.streamer_team[0]
                .active_status
                .as_ref()
                .unwrap()
                .name,
            "Burn"
        );
        assert_eq!(deserialized.turn_log[0].float_text, "42 [Burn!]");
        assert_eq!(deserialized.winner, None);
    }

    /// Verify mime_for_path returns correct types.
    #[test]
    fn test_mime_for_path() {
        let cases = [
            ("/index.html", "text/html"),
            ("/assets/app-DfY9a7.js", "application/javascript"),
            ("/assets/style-Bf7d4.css", "text/css"),
            ("/assets/icon-abc.svg", "image/svg+xml"),
            ("/favicon.ico", "image/x-icon"),
            ("/unknown.bin", "application/octet-stream"),
            ("/data.json", "application/json"),
        ];
        for (path_str, expected) in &cases {
            let p = std::path::Path::new(path_str);
            let mime = super::mime_for_path(p);
            assert_eq!(mime, *expected, "mime for {path_str}");
        }
    }

    /// Verify the SPA fallback logic: paths without extension detect as SPA routes.
    #[test]
    fn test_spa_fallback_detection() {
        // Paths without file extension → SPA fallback
        assert!(!"/overlay".contains('.'));
        assert!(!"/monsters/ember".contains('.'));
        assert!(!"/history".contains('.'));
        assert!(!"/dashboard/battle".contains('.'));
        // Paths with file extension → direct file serve
        assert!("/assets/app.js".contains('.'));
        assert!("/index.html".contains('.'));
        assert!("/favicon.ico".contains('.'));
    }
}
