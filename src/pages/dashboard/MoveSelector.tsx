import type { Ability } from '../../lib/invoke'
import TypeBadge from '../overlay/TypeBadge'

interface Props {
  abilities: Ability[]
  monsterName: string
  mp: number
  disabled: boolean
  isStunned: boolean
  onSelect: (abilityId: number) => void
}

/// Move selector — shows a monster's abilities as a grid of buttons.
export default function MoveSelector({ abilities, monsterName, mp, disabled, isStunned, onSelect }: Props) {
  if (isStunned) {
    return (
      <div className="text-zinc-500 text-sm italic p-4 border border-zinc-700 rounded">
        {monsterName} is stunned — cannot act!
      </div>
    )
  }

  return (
    <div>
      <div className="text-sm text-zinc-400 mb-2">{monsterName}'s moves:</div>
      <div className="grid grid-cols-2 gap-2">
        {abilities.map(a => {
          const insufficientMp = mp < a.mp_cost
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              disabled={disabled || insufficientMp}
              className={`border rounded p-2 text-left text-xs transition-all ${
                insufficientMp
                  ? 'border-zinc-800 bg-zinc-900 text-zinc-600 cursor-not-allowed'
                  : 'border-zinc-600 hover:border-amber-500 bg-zinc-800/50 hover:bg-zinc-700/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{a.name}</span>
                <TypeBadge type={a.ability_type} />
              </div>
              <div className="text-zinc-500">
                {a.mp_cost} MP · Power {a.power}
              </div>
              {a.effect && <div className="text-zinc-600 mt-1">{a.effect}</div>}
            </button>
          )
        })}
        {/* Basic Attack — always available */}
        <button
          onClick={() => onSelect(0)}
          disabled={disabled}
          className="border border-zinc-600 hover:border-amber-500 bg-zinc-800/50 hover:bg-zinc-700/50 rounded p-2 text-left text-xs"
        >
          <div className="font-medium text-sm">Basic Attack</div>
          <div className="text-zinc-500">0 MP · Power 10</div>
        </button>
      </div>
    </div>
  )
}
