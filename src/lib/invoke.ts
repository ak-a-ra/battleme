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
  resolveTurn: (streamerMove: any, chatMove: any) =>
    invoke<any>('resolve_turn', { streamerMove, chatMove }),
}
