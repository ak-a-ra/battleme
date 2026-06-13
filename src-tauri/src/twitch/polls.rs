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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_poll_body_serialization() {
        let choices = vec!["Basic Attack".to_string(), "Fire Blast".to_string()];
        let body = json!({
            "broadcaster_id": "12345",
            "title": "Choose your move!",
            "choices": choices.iter().map(|c| json!({"title": c})).collect::<Vec<_>>(),
            "duration": 30,
        });
        assert_eq!(body["broadcaster_id"], "12345");
        assert_eq!(body["title"], "Choose your move!");
        assert_eq!(body["duration"], 30);
        assert_eq!(body["choices"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_poll_response_parse() {
        let json = r#"{"data": [{"id": "poll_abc123"}]}"#;
        let res: serde_json::Value = serde_json::from_str(json).unwrap();
        let poll_id = res["data"][0]["id"].as_str().unwrap_or("").to_string();
        assert_eq!(poll_id, "poll_abc123");
    }
}
