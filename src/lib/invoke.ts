import { invoke } from '@tauri-apps/api/core'

// ── Types ──
export interface Monster {
  id: number
  name: string
  sprite_id: string
  monster_type: string
  hp: number
  mp: number
  str_stat: number
  agi: number
  dex: number
  int_stat: number
  luck: number
  lore: string
  generated_by_llm: boolean
}

export interface Hunter {
  id: number
  name: string
  sprite_id: string
  class: string
  hp: number
  mp: number
  str_stat: number
  agi: number
  dex: number
  int_stat: number
  luck: number
  lore: string
}

export interface Ability {
  id: number
  name: string
  mp_cost: number
  power: number
  ability_type: string
  effect: string
  status_inflict_id: number | null
  is_passive: boolean
}

export interface StatusEffect {
  id: number
  name: string
  icon: string
  effect_per_turn: string
  duration: number
  visual_color: string
}

export interface StreamerLineup {
  hunter: Hunter
  monsters: Monster[]
}

export interface BattleState {
  streamer_team: any[]
  chat_team: any[]
  turn_number: number
  winner: string | null
  turn_log: any[]
  phase: string
}

export interface AbilityInput {
  name: string
  base_power: number
  ability_type: string
  status_inflict_name: string | null
  status_duration: number
}

export interface TypeChartEntry {
  attacker: string
  defender: string
  multiplier: number
}

export interface BattleLog {
  id: number
  date: string
  winner_side: string
  streamer_team: string
  chat_team: string
  turns: string
  duration_secs: number
}

/** Typed wrapper around Tauri invoke commands. */
export const api = {
  // Monsters
  getMonsters: () => invoke<Monster[]>('get_monsters'),
  createMonster: (monster: Omit<Monster, 'id'>) => invoke<number>('create_monster', { monster }),
  updateMonster: (monster: Monster) => invoke<void>('update_monster', { monster }),
  deleteMonster: (id: number) => invoke<void>('delete_monster', { id }),

  // Hunters
  getHunters: () => invoke<Hunter[]>('get_hunters'),
  createHunter: (hunter: Omit<Hunter, 'id'>) => invoke<number>('create_hunter', { hunter }),
  updateHunter: (hunter: Hunter) => invoke<void>('update_hunter', { hunter }),
  deleteHunter: (id: number) => invoke<void>('delete_hunter', { id }),

  // Abilities
  getAbilitiesForMonster: (monsterId: number) =>
    invoke<Ability[]>('get_abilities_for_monster', { monsterId }),
  createAbility: (ability: Omit<Ability, 'id'>) => invoke<number>('create_ability', { ability }),
  updateAbility: (ability: Ability) => invoke<void>('update_ability', { ability }),
  deleteAbility: (id: number) => invoke<void>('delete_ability', { id }),
  assignAbilityToMonster: (monsterId: number, abilityId: number) =>
    invoke<void>('assign_ability_to_monster', { monsterId, abilityId }),
  unassignAbilityFromMonster: (monsterId: number, abilityId: number) =>
    invoke<void>('unassign_ability_from_monster', { monsterId, abilityId }),

  // Status Effects
  getStatusEffects: () => invoke<StatusEffect[]>('get_status_effects'),
  createStatusEffect: (effect: Omit<StatusEffect, 'id'>) => invoke<number>('create_status_effect', { effect }),
  updateStatusEffect: (effect: StatusEffect) => invoke<void>('update_status_effect', { effect }),
  deleteStatusEffect: (id: number) => invoke<void>('delete_status_effect', { id }),

  // Settings
  getSettings: () => invoke<Record<string, string>>('get_settings'),
  saveSettings: (settings: Record<string, string>) =>
    invoke<void>('save_settings', { settings }),

  // LLM
  generateMonsterStats: (name: string, monsterType: string) =>
    invoke<Record<string, any>>('generate_monster_stats', { name, monsterType }),

  // Battle
  resolveTurn: (streamerMove: AbilityInput, chatMove: AbilityInput) =>
    invoke<any>('resolve_turn', { streamerMove, chatMove }),

  getBattleState: () =>
    invoke<BattleState>('get_battle_state'),

  getAbilityInput: (abilityId: number) =>
    invoke<AbilityInput>('get_ability_input', { abilityId }),

  surrender: (winnerSide: string) =>
    invoke<BattleState>('surrender', { winnerSide }),

  saveBattleResult: () =>
    invoke<void>('save_battle_result'),

  // Draft
  startPoll: (title: string, choices: string[], durationSecs: number) =>
    invoke<string>('start_poll', { title, choices, durationSecs }),

  saveStreamerLineup: (hunterId: number, monsterIds: number[]) =>
    invoke<void>('save_streamer_lineup', { hunterId, monsterIds }),

  getStreamerLineup: () =>
    invoke<StreamerLineup | null>('get_streamer_lineup'),

  setBattlePhase: (phase: string) =>
    invoke<void>('set_battle_phase', { phase }),

  startBattle: (chatMonsterIds: number[]) =>
    invoke<BattleState>('start_battle', { chatMonsterIds }),

  // Wiki
  getTypeChart: () =>
    invoke<TypeChartEntry[]>('get_type_chart'),

  // History
  getBattleLogs: () =>
    invoke<BattleLog[]>('get_battle_logs'),
  getBattleLog: (id: number) =>
    invoke<BattleLog | null>('get_battle_log', { id }),
}
