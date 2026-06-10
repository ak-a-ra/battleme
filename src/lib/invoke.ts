import { invoke } from '@tauri-apps/api/core'

/** Typed wrapper around Tauri invoke commands. */
export const api = {
  // Monsters
  getMonsters: () => invoke('get_monsters'),
  createMonster: (monster: any) => invoke('create_monster', { monster }),
  updateMonster: (monster: any) => invoke('update_monster', { monster }),
  deleteMonster: (id: number) => invoke('delete_monster', { id }),

  // Hunters
  getHunters: () => invoke('get_hunters'),
  createHunter: (hunter: any) => invoke('create_hunter', { hunter }),
  updateHunter: (hunter: any) => invoke('update_hunter', { hunter }),
  deleteHunter: (id: number) => invoke('delete_hunter', { id }),

  // Abilities
  getAbilitiesForMonster: (monsterId: number) =>
    invoke('get_abilities_for_monster', { monsterId }),
  createAbility: (ability: any) => invoke('create_ability', { ability }),
  updateAbility: (ability: any) => invoke('update_ability', { ability }),
  deleteAbility: (id: number) => invoke('delete_ability', { id }),
  assignAbilityToMonster: (monsterId: number, abilityId: number) =>
    invoke('assign_ability_to_monster', { monsterId, abilityId }),

  // Status Effects
  getStatusEffects: () => invoke('get_status_effects'),
  createStatusEffect: (effect: any) => invoke('create_status_effect', { effect }),
  updateStatusEffect: (effect: any) => invoke('update_status_effect', { effect }),
  deleteStatusEffect: (id: number) => invoke('delete_status_effect', { id }),

  // Settings
  getSettings: () => invoke('get_settings'),
  saveSettings: (settings: Record<string, string>) =>
    invoke('save_settings', { settings }),
}
