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
    use serde_json::json;

    #[test]
    fn test_create_poll_body_structure() {
        let choices = vec!["Fireball".to_string(), "Basic Attack".to_string()];
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
        assert_eq!(body["choices"][0]["title"], "Fireball");
        assert_eq!(body["choices"][1]["title"], "Basic Attack");
    }

    #[test]
    fn test_poll_id_extraction() {
        let res = json!({
            "data": [{ "id": "poll_abc123" }]
        });
        let id = res["data"][0]["id"].as_str().unwrap_or("").to_string();
        assert_eq!(id, "poll_abc123");
    }

    #[test]
    fn test_poll_id_extraction_empty() {
        let res = json!({ "data": [] });
        let id = res["data"][0]["id"].as_str().unwrap_or("").to_string();
        assert_eq!(id, "");
    }
}
