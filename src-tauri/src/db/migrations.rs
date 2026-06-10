use rusqlite::Connection;

pub fn run(conn: &Connection) {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS status_effects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            icon TEXT NOT NULL,
            effect_per_turn TEXT DEFAULT '',
            duration INTEGER NOT NULL DEFAULT 3,
            visual_color TEXT DEFAULT '#ffffff'
        );

        CREATE TABLE IF NOT EXISTS monsters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sprite_id TEXT NOT NULL,
            monster_type TEXT NOT NULL,
            hp INTEGER NOT NULL,
            mp INTEGER NOT NULL,
            str_stat INTEGER NOT NULL,
            agi INTEGER NOT NULL,
            dex INTEGER NOT NULL,
            int_stat INTEGER NOT NULL,
            luck INTEGER NOT NULL,
            lore TEXT DEFAULT '',
            generated_by_llm INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS hunters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sprite_id TEXT NOT NULL,
            class TEXT NOT NULL,
            hp INTEGER NOT NULL,
            mp INTEGER NOT NULL,
            str_stat INTEGER NOT NULL,
            agi INTEGER NOT NULL,
            dex INTEGER NOT NULL,
            int_stat INTEGER NOT NULL,
            luck INTEGER NOT NULL,
            lore TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS abilities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mp_cost INTEGER NOT NULL DEFAULT 0,
            power INTEGER NOT NULL DEFAULT 0,
            ability_type TEXT NOT NULL,
            effect TEXT DEFAULT '',
            status_inflict_id INTEGER REFERENCES status_effects(id),
            is_passive INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS monster_abilities (
            monster_id INTEGER REFERENCES monsters(id),
            ability_id INTEGER REFERENCES abilities(id),
            PRIMARY KEY (monster_id, ability_id)
        );

        CREATE TABLE IF NOT EXISTS hunter_abilities (
            hunter_id INTEGER REFERENCES hunters(id),
            ability_id INTEGER REFERENCES abilities(id),
            PRIMARY KEY (hunter_id, ability_id)
        );

        CREATE TABLE IF NOT EXISTS battle_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            winner_side TEXT NOT NULL,
            streamer_team TEXT NOT NULL,
            chat_team TEXT NOT NULL,
            turns TEXT NOT NULL DEFAULT '[]',
            duration_secs INTEGER DEFAULT 0
        );
        ",
    )
    .unwrap();
}
