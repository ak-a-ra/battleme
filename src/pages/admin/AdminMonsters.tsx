import { useEffect, useState } from 'react'
import { api, type Monster, type Ability } from '../../lib/invoke'
import MonsterForm from './MonsterForm'
import AbilityManager from './AbilityManager'

export default function AdminMonsters() {
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [abilities, setAbilities] = useState<Record<number, Ability[]>>({})
  const [showForm, setShowForm] = useState(false)
  const [editMonster, setEditMonster] = useState<Monster | undefined>()
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = async () => {
    const data = await api.getMonsters()
    setMonsters(data)
  }

  const loadAbilities = async (monsterId: number) => {
    const data = await api.getAbilitiesForMonster(monsterId)
    setAbilities(prev => ({ ...prev, [monsterId]: data }))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (expandedId !== null) {
      loadAbilities(expandedId)
    }
  }, [expandedId])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this monster?')) return
    await api.deleteMonster(id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Monsters</h1>
        <button onClick={() => { setEditMonster(undefined); setShowForm(true) }}
          className="px-3 py-1 bg-amber-600 rounded text-sm hover:bg-amber-500">+ Add Monster</button>
      </div>

      {showForm && (
        <MonsterForm
          initial={editMonster}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-400">
            <th className="py-2 px-2">Name</th>
            <th className="py-2 px-2">Type</th>
            <th className="py-2 px-2">HP</th>
            <th className="py-2 px-2">MP</th>
            <th className="py-2 px-2">STR/AGI/DEX/INT/LUK</th>
            <th className="py-2 px-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {monsters.map(m => (
            <>
              <tr key={m.id} className="border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}>
                <td className="py-2 px-2">
                  {m.name}
                  {m.generated_by_llm && <span className="ml-1 text-[10px] bg-purple-800 px-1 rounded">LLM</span>}
                </td>
                <td className="py-2 px-2">
                  <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{m.monster_type}</span>
                </td>
                <td className="py-2 px-2">{m.hp}</td>
                <td className="py-2 px-2">{m.mp}</td>
                <td className="py-2 px-2 text-zinc-400">{m.str_stat}/{m.agi}/{m.dex}/{m.int_stat}/{m.luck}</td>
                <td className="py-2 px-2 flex gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditMonster(m); setShowForm(true) }}
                    className="text-amber-400 hover:text-amber-300">Edit</button>
                  <button onClick={() => handleDelete(m.id)}
                    className="text-red-400 hover:text-red-300">Delete</button>
                </td>
              </tr>
              {expandedId === m.id && (
                <tr key={`${m.id}-abilities`}>
                  <td colSpan={6} className="bg-zinc-900 px-4 py-3">
                    <AbilityManager
                      monsterId={m.id}
                      abilities={abilities[m.id] || []}
                      onReload={() => loadAbilities(m.id)}
                    />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
