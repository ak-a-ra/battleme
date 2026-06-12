use reqwest::Client;
use serde_json::json;

/// Create a Twitch poll.
///
/// POST https://api.twitch.tv/helix/polls
/// Returns the poll ID on success.
pub async fn create_poll(
    client_id: &str,
    token: &str,
    broadcaster_id: &str,
    title: &str,
    choices: &[String],
    duration_secs: u32,
) -> Result<String, String> {
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
        .send()
        .await
        .map_err(|e| format!("Poll create failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Poll parse failed: {e}"))?;

    Ok(res["data"][0]["id"]
        .as_str()
        .unwrap_or("")
        .to_string())
}
