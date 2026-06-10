import { useState, useEffect } from 'react';

const BRIDGE_URL = 'http://localhost:38021';

export interface OverlayBattleState {
  streamer_team: OverlayMon[];
  chat_team: OverlayMon[];
  turn_number: number;
  winner: string | null;
  turn_log: TurnLogEntry[];
}

interface OverlayMon {
  id: number;
  name: string;
  monster_type: string;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  str_stat: number;
  agi: number;
  dex: number;
  int_stat: number;
  luck: number;
  active_status: { name: string; turns_left: number; intensity: number } | null;
  is_ko: boolean;
}

interface TurnLogEntry {
  attacker_side: string;
  attacker_name: string;
  ability_used: string;
  damage_dealt: number;
  is_crit: boolean;
  status_inflicted: string | null;
  target_hp_after: number;
  target_ko: boolean;
  float_text: string;
}

/**
 * Polls the HTTP bridge at GET /api/battle-state every 1s.
 * Returns null while the bridge is unavailable (graceful degrade).
 */
export function useBattleState(): OverlayBattleState | null {
  const [state, setState] = useState<OverlayBattleState | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/battle-state`);
        if (res.ok) {
          setState(await res.json());
        }
      } catch {
        // bridge not ready yet — ignore
      }
    };

    poll();
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}
