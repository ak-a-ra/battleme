use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

/// Get a Twitch app access token using client credentials flow.
///
/// POST https://id.twitch.tv/oauth2/token
/// with `client_id`, `client_secret`, `grant_type=client_credentials`
pub async fn get_app_token(client_id: &str, client_secret: &str) -> Result<String, String> {
    let client = Client::new();
    let res: TokenResponse = client
        .post("https://id.twitch.tv/oauth2/token")
        .query(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Token parse failed: {e}"))?;
    Ok(res.access_token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_response_deserialize() {
        let json = r#"{"access_token": "test_token_123"}"#;
        let resp: TokenResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.access_token, "test_token_123");
    }
}
