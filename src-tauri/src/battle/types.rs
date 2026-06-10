use serde::{Deserialize, Serialize};

/// Minimal BattleState placeholder.
/// Fleshed out with full battle fields in task-04.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BattleState {
    pub phase: String,
}
