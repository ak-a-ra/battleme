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
