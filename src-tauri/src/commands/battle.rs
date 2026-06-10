use crate::battle::engine;
use crate::battle::types::{AbilityInput, BattleState};
use crate::AppState;

#[tauri::command]
pub async fn resolve_turn(
    state: tauri::State<'_, AppState>,
    streamer_move: AbilityInput,
    chat_move: AbilityInput,
) -> Result<BattleState, String> {
    let mut battle = state
        .battle_state
        .write()
        .map_err(|e| format!("Lock error: {}", e))?;

    engine::resolve(&mut battle, &streamer_move, &chat_move);

    Ok(battle.clone())
}
