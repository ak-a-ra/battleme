use crate::battle::types::BattleState;
use std::sync::{Arc, RwLock};
use std::thread;

/// Start the HTTP bridge on port 38021 in a background thread.
///
/// Serves `GET /api/battle-state` as JSON from the shared `Arc<RwLock<BattleState>>`.
/// Degrades gracefully if port is in use — prints a warning and returns.
pub fn start(state: Arc<RwLock<BattleState>>) {
    let server = match tiny_http::Server::http("127.0.0.1:38021") {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[bridge] WARN: failed to bind :38021 — {e}");
            return;
        }
    };

    thread::spawn(move || {
        for request in server.incoming_requests() {
            let response = match request.method() {
                // CORS preflight — required by OBS CEF (Chromium Embedded)
                &tiny_http::Method::Options => {
                    tiny_http::Response::from_string("")
                        .with_status_code(200)
                        .with_header(cors_header())
                }
                _ => match request.url() {
                    "/api/battle-state" => {
                        let s = state.read().unwrap();
                        let body =
                            serde_json::to_string(&*s).unwrap_or_else(|_| "{}".to_string());
                        tiny_http::Response::from_string(body)
                            .with_status_code(200)
                            .with_header(cors_header())
                            .with_header(
                                "Content-Type: application/json"
                                    .parse::<tiny_http::Header>()
                                    .unwrap(),
                            )
                    }
                    _ => tiny_http::Response::from_string("Not Found").with_status_code(404),
                },
            };
            let _ = request.respond(response);
        }
    });
}

fn cors_header() -> tiny_http::Header {
    "Access-Control-Allow-Origin: *"
        .parse::<tiny_http::Header>()
        .unwrap()
}

#[cfg(test)]
mod tests {
    use crate::battle::types::*;

    /// Validates that the BattleState JSON contract is stable across serde.
    /// Catches field additions/removals or type changes that would break the overlay.
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
}
