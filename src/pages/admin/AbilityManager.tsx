import { useState } from 'react'
import { api, type Ability } from '../../lib/invoke'

interface Props {
  monsterId: number
  abilities: Ability[]
  onReload: () => void
}

interface AbilityForm {
  name: string
  mp_cost: number
  power: number
  ability_type: string
  effect: string
  status_inflict_id: number | null
  is_passive: boolean
}

const emptyAbility: AbilityForm = { name: '', mp_cost: 5, power: 10, ability_type: 'physical', effect: '', status_inflict_id: null, is_passive: false }

export default function AbilityManager({ monsterId, abilities, onReload }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyAbility)
  const [editingId, setEditingId] = useState<number | null>(null)

  const handleSave = async () => {
    if (editingId !== null) {
      await api.updateAbility({ ...form, id: editingId })
    } else {
      const id = await api.createAbility(form)
      await api.assignAbilityToMonster(monsterId, id)
    }
    setShowForm(false)
    setEditingId(null)
    setForm(emptyAbility)
    onReload()
  }

  const handleEdit = (a: Ability) => {
    setForm({
      name: a.name,
      mp_cost: a.mp_cost,
      power: a.power,
      ability_type: a.ability_type,
      effect: a.effect,
      status_inflict_id: a.status_inflict_id,
      is_passive: a.is_passive,
    })
    setEditingId(a.id)
    setShowForm(true)
  }

  const handleDelete = async (abilityId: number) => {
    await api.unassignAbilityFromMonster(monsterId, abilityId)
    onReload()
  }

  const active = abilities.filter(a => !a.is_passive)
  const passives = abilities.filter(a => a.is_passive)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-zinc-300">Abilities</h3>
        <button onClick={() => { setForm(emptyAbility); setEditingId(null); setShowForm(true) }}
          className="text-xs px-2 py-1 bg-amber-600 rounded hover:bg-amber-500">+ Add</button>
      </div>

      {showForm && (
        <div className="bg-zinc-800 p-3 rounded mb-3 border border-zinc-600">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input placeholder="Name" className="bg-zinc-700 p-1 rounded" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="bg-zinc-700 p-1 rounded" value={form.ability_type}
              onChange={e => setForm({ ...form, ability_type: e.target.value })}>
              <option value="physical">Physical</option>
              <option value="magic">Magic</option>
            </select>
            <input type="number" placeholder="MP Cost" className="bg-zinc-700 p-1 rounded" value={form.mp_cost}
              onChange={e => setForm({ ...form, mp_cost: Number(e.target.value) })} />
            <input type="number" placeholder="Power" className="bg-zinc-700 p-1 rounded" value={form.power}
              onChange={e => setForm({ ...form, power: Number(e.target.value) })} />
            <input placeholder="Effect" className="bg-zinc-700 p-1 rounded col-span-2" value={form.effect}
              onChange={e => setForm({ ...form, effect: e.target.value })} />
            <label className="flex items-center gap-1 text-zinc-400">
              <input type="checkbox" checked={form.is_passive}
                onChange={e => setForm({ ...form, is_passive: e.target.checked })} /> Passive
            </label>
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-2 py-1 rounded bg-zinc-600 hover:bg-zinc-500">Cancel</button>
            <button onClick={handleSave} className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500">Save</button>
          </div>
        </div>
      )}

      {/* Active abilities */}
      {active.length > 0 && (
        <div className="mb-2">
          <h4 className="text-[10px] uppercase text-zinc-500 mb-1">Active</h4>
          <div className="flex flex-col gap-1">
            {active.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-zinc-800 rounded px-2 py-1 text-xs">
                <span>{a.name} <span className="text-zinc-500">({a.mp_cost}MP · {a.power}pwr · {a.ability_type})</span></span>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(a)} className="text-amber-400 hover:text-amber-300">Edit</button>
                  <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-300">X</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Passive abilities */}
      {passives.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase text-zinc-500 mb-1">Passive</h4>
          <div className="flex flex-col gap-1">
            {passives.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-zinc-800 rounded px-2 py-1 text-xs">
                <span>{a.name} <span className="text-zinc-500">({a.effect})</span></span>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(a)} className="text-amber-400 hover:text-amber-300">Edit</button>
                  <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-300">X</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
