use rusqlite::Connection;

pub fn run_if_empty(conn: &Connection) {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM monsters", [], |r| r.get(0))
        .unwrap_or(0);
    if count > 0 {
        return;
    }

    seed_status_effects(conn);
    seed_monsters(conn);
    seed_default_hunter(conn);
    seed_abilities(conn);
}

fn seed_status_effects(conn: &Connection) {
    let effects = vec![
        ("Burn", "🔥", "Flat fire damage per turn", 3, "#ff4400"),
        ("Poison", "☠️", "DoT that intensifies each turn +10%", 4, "#44ff00"),
        ("Freeze", "❄️", "Reduces AGI and dodge chance", 3, "#00aaff"),
        ("Stun", "⚡", "Skip turn entirely", 1, "#ffff00"),
        ("Blind", "👁️", "Reduces physical accuracy", 3, "#888888"),
        ("Slow", "🐌", "Reduces AGI", 3, "#996633"),
        ("Fear", "😱", "Monster can only use basic attack", 3, "#aa00ff"),
        ("Bleeding", "🩸", "DoT as % of max HP per turn", 3, "#cc0000"),
        ("Sleep", "💤", "Skip multiple turns, breaks on damage", 3, "#6666ff"),
    ];
    for (name, icon, effect, duration, color) in effects {
        conn.execute(
            "INSERT OR IGNORE INTO status_effects (name, icon, effect_per_turn, duration, visual_color)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (name, icon, effect, duration, color),
        )
        .unwrap();
    }
}

fn seed_monsters(conn: &Connection) {
    // 2 monsters per type (Fire, Water, Earth, Wind, Dark, Light)
    let monsters = vec![
        ("Emberwolf", "emberwolf", "Fire", 120, 60, 18, 14, 12, 10, 8),
        ("Flamecrow", "flamecrow", "Fire", 100, 80, 14, 16, 15, 14, 10),
        ("Tidalfin", "tidalfin", "Water", 130, 70, 15, 12, 13, 16, 9),
        ("Stormray", "stormray", "Water", 110, 90, 12, 14, 14, 18, 11),
        ("Stoneback", "stoneback", "Earth", 160, 40, 20, 8, 10, 8, 7),
        ("Mudcrawler", "mudcrawler", "Earth", 140, 50, 16, 10, 12, 10, 9),
        ("Galebird", "galebird", "Wind", 90, 70, 13, 20, 17, 12, 12),
        ("Driftfang", "driftfang", "Wind", 100, 60, 15, 18, 16, 10, 10),
        ("Voidshade", "voidshade", "Dark", 115, 85, 16, 15, 13, 18, 13),
        ("Grimspawn", "grimspawn", "Dark", 125, 75, 19, 13, 11, 14, 11),
        ("Dawnwing", "dawnwing", "Light", 120, 80, 14, 16, 15, 16, 14),
        ("Solarclaw", "solarclaw", "Light", 110, 90, 13, 15, 16, 18, 15),
    ];
    for (name, sprite, mtype, hp, mp, str, agi, dex, intel, luck) in monsters {
        conn.execute(
            "INSERT INTO monsters (name, sprite_id, monster_type, hp, mp, str_stat, agi, dex, int_stat, luck)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (name, sprite, mtype, hp, mp, str, agi, dex, intel, luck),
        )
        .unwrap();
    }
}

fn seed_default_hunter(conn: &Connection) {
    conn.execute(
        "INSERT OR IGNORE INTO hunters (name, sprite_id, class, hp, mp, str_stat, agi, dex, int_stat, luck)
         VALUES ('Hunter', 'hunter_default', 'Fighter', 200, 100, 15, 15, 15, 15, 10)",
        [],
    )
    .unwrap();
}

fn seed_abilities(conn: &Connection) {
    // Create 2 combat abilities
    conn.execute(
        "INSERT OR IGNORE INTO abilities (id, name, mp_cost, power, ability_type, effect, status_inflict_id, is_passive) VALUES (1, 'Power Strike', 10, 25, 'physical', 'A powerful physical attack', NULL, 0)",
        [],
    ).unwrap();
    conn.execute(
        "INSERT OR IGNORE INTO abilities (id, name, mp_cost, power, ability_type, effect, status_inflict_id, is_passive) VALUES (2, 'Elemental Blast', 15, 30, 'magic', 'An elemental magic attack', NULL, 0)",
        [],
    ).unwrap();

    // Assign both abilities to all 12 monsters
    for monster_id in 1..=12 {
        conn.execute(
            "INSERT OR IGNORE INTO monster_abilities (monster_id, ability_id) VALUES (?1, 1)",
            [monster_id],
        ).unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO monster_abilities (monster_id, ability_id) VALUES (?1, 2)",
            [monster_id],
        ).unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seed_populates_all_tables() {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn);
        run_if_empty(&conn);

        let monster_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM monsters", [], |r| r.get(0))
            .unwrap();
        assert_eq!(monster_count, 12, "should seed 12 monsters");

        let status_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM status_effects", [], |r| r.get(0))
            .unwrap();
        assert_eq!(status_count, 9, "should seed 9 status effects");

        let hunter_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM hunters", [], |r| r.get(0))
            .unwrap();
        assert_eq!(hunter_count, 1, "should seed 1 hunter");

        let ability_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM abilities", [], |r| r.get(0))
            .unwrap();
        assert_eq!(ability_count, 2, "should seed 2 abilities");

        let assignments: i64 = conn
            .query_row("SELECT COUNT(*) FROM monster_abilities", [], |r| r.get(0))
            .unwrap();
        assert_eq!(assignments, 24, "should assign 2 abilities to 12 monsters");
    }

    #[test]
    fn test_run_if_empty_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn);
        run_if_empty(&conn);
        run_if_empty(&conn); // second call

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM monsters", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 12, "second run should not duplicate rows");
    }

    #[test]
    fn test_file_backed_db_init() {
        let path = "test_battleme.db";
        // Clean up from any previous failed run
        let _ = std::fs::remove_file(path);

        let conn = Connection::open(path).unwrap();
        crate::db::migrations::run(&conn);
        run_if_empty(&conn);
        drop(conn);

        // Verify via a new connection to the same file
        let conn2 = Connection::open(path).unwrap();
        let monster_count: i64 = conn2
            .query_row("SELECT COUNT(*) FROM monsters", [], |r| r.get(0))
            .unwrap();
        assert_eq!(monster_count, 12);
        let status_count: i64 = conn2
            .query_row("SELECT COUNT(*) FROM status_effects", [], |r| r.get(0))
            .unwrap();
        assert_eq!(status_count, 9);
        let hunter_count: i64 = conn2
            .query_row("SELECT COUNT(*) FROM hunters", [], |r| r.get(0))
            .unwrap();
        assert_eq!(hunter_count, 1);
        let ability_count: i64 = conn2
            .query_row("SELECT COUNT(*) FROM abilities", [], |r| r.get(0))
            .unwrap();
        assert_eq!(ability_count, 2);
        let assignments: i64 = conn2
            .query_row("SELECT COUNT(*) FROM monster_abilities", [], |r| r.get(0))
            .unwrap();
        assert_eq!(assignments, 24);
        drop(conn2);

        // Cleanup
        std::fs::remove_file(path).unwrap();
    }
}
