use crate::AppState;
use serde_json::Value;

/// Generate monster stats using Anthropic's Claude API.
///
/// Sends name + type, returns JSON with hp, mp, stats, abilities, lore.
/// Returns an error object if ANTHROPIC_API_KEY is not set.
#[tauri::command]
pub async fn generate_monster_stats(
    _state: tauri::State<'_, AppState>,
    name: String,
    monster_type: String,
) -> Result<Value, String> {
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY not set".to_string())?;

    let client = reqwest::Client::new();

    let prompt = format!(
        "Generate stats for a monster named '{}' of type '{}' for a turn-based RPG battle game. \
        Return ONLY valid JSON with these exact keys: \
        hp (50-200), mp (30-120), str_stat (5-25), agi (5-25), dex (5-25), int_stat (5-25), luck (5-20), \
        abilities (array of 4 objects with: name, mp_cost, power, ability_type, effect), \
        passives (array of 4 objects with: name, effect), \
        lore (1 sentence flavor text). \
        No markdown, no explanation, only the JSON object.",
        name, monster_type
    );

    let body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1000,
        "messages": [{ "role": "user", "content": prompt }]
    });

    let res: Value = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic API request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Anthropic API parse failed: {e}"))?;

    // Extract text content and parse as JSON
    let text = res["content"][0]["text"]
        .as_str()
        .unwrap_or("{}");

    serde_json::from_str(text).map_err(|e| format!("LLM response JSON parse error: {e}"))
}
