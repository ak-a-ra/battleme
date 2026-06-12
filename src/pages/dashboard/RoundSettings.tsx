import type { Settings } from '../../hooks/useBattleControls'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

/// Round settings — poll duration and fallback strategy.
export default function RoundSettings({ settings, onChange }: Props) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">Round Settings</h3>
      <div className="flex gap-6">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Poll Duration (sec)</label>
          <input
            type="number"
            min={5}
            max={300}
            value={settings.pollDuration}
            onChange={e => onChange({ ...settings, pollDuration: Math.max(5, Math.min(300, +e.target.value)) })}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm w-24"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Fallback</label>
          <select
            value={settings.fallback}
            onChange={e => onChange({ ...settings, fallback: e.target.value as 'random' | 'basic' })}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
          >
            <option value="basic">Basic Attack</option>
            <option value="random">Random Move</option>
          </select>
        </div>
      </div>
    </div>
  )
}
