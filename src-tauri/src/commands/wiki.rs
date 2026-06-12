use serde::Serialize;
use tauri::State;
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct TypeChartEntry {
    pub attacker: String,
    pub defender: String,
    pub multiplier: f64,
}

/// Returns the full 6×6 type effectiveness chart.
/// Single source of truth — mirrors battle::types::type_multiplier().
#[tauri::command]
pub fn get_type_chart(_state: State<'_, AppState>) -> Vec<TypeChartEntry> {
    let types = ["Fire", "Water", "Earth", "Wind", "Dark", "Light"];
    let mut chart = Vec::with_capacity(36);

    for &attacker in &types {
        for &defender in &types {
            let multiplier = crate::battle::types::type_multiplier(attacker, defender);
            chart.push(TypeChartEntry {
                attacker: attacker.to_string(),
                defender: defender.to_string(),
                multiplier,
            });
        }
    }

    chart
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_type_chart_has_36_entries() {
        let types = ["Fire", "Water", "Earth", "Wind", "Dark", "Light"];
        let mut chart = Vec::with_capacity(36);
        for &attacker in &types {
            for &defender in &types {
                let multiplier = crate::battle::types::type_multiplier(attacker, defender);
                chart.push(TypeChartEntry {
                    attacker: attacker.to_string(),
                    defender: defender.to_string(),
                    multiplier,
                });
            }
        }
        assert_eq!(chart.len(), 36);

        // Spot-check known matchups
        let fire_water = chart.iter().find(|e| e.attacker == "Fire" && e.defender == "Water").unwrap();
        assert!((fire_water.multiplier - 0.5).abs() < 1e-9);

        let fire_earth = chart.iter().find(|e| e.attacker == "Fire" && e.defender == "Earth").unwrap();
        assert!((fire_earth.multiplier - 1.5).abs() < 1e-9);

        let dark_dark = chart.iter().find(|e| e.attacker == "Dark" && e.defender == "Dark").unwrap();
        assert!((dark_dark.multiplier - 0.5).abs() < 1e-9);

        // Neutral
        let fire_light = chart.iter().find(|e| e.attacker == "Fire" && e.defender == "Light").unwrap();
        assert!((fire_light.multiplier - 1.0).abs() < 1e-9);
    }
}
