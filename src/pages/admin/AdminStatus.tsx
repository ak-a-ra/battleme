import { useEffect, useState } from 'react'
import { api } from '../../lib/invoke'
import type { StatusEffect } from '../../lib/invoke'

const defaultForm = { name: '', icon: '', effect_per_turn: '', duration: 3, visual_color: '#ffffff' }

export default function AdminStatus() {
  const [effects, setEffects] = useState<StatusEffect[]>([])
  const [form, setForm] = useState<{ id?: number; name: string; icon: string; effect_per_turn: string; duration: number; visual_color: string }>(defaultForm)
  const [editing, setEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    const data = await api.getStatusEffects() as StatusEffect[]
    setEffects(data)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (editing && form.id) {
      await api.updateStatusEffect({ ...form, id: form.id })
    } else {
      await api.createStatusEffect(form)
    }
    setShowForm(false)
    setEditing(false)
    setForm(defaultForm)
    load()
  }

  const handleEdit = (e: StatusEffect) => {
    setForm({ id: e.id, name: e.name, icon: e.icon, effect_per_turn: e.effect_per_turn, duration: e.duration, visual_color: e.visual_color })
    setEditing(true)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    await api.deleteStatusEffect(id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Status Effects</h1>
        <button onClick={() => { setForm(defaultForm); setEditing(false); setShowForm(true) }}
          className="px-3 py-1 bg-amber-600 rounded text-sm hover:bg-amber-500">+ Add</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-700 w-[400px]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? 'Edit' : 'Add'} Status Effect</h2>
            <div className="flex flex-col gap-3">
              <input placeholder="Name" className="bg-zinc-800 p-2 rounded text-sm" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
              <input placeholder="Icon (emoji)" className="bg-zinc-800 p-2 rounded text-sm" value={form.icon}
                onChange={e => setForm({ ...form, icon: e.target.value })} />
              <input placeholder="Effect per turn" className="bg-zinc-800 p-2 rounded text-sm" value={form.effect_per_turn}
                onChange={e => setForm({ ...form, effect_per_turn: e.target.value })} />
              <label className="text-xs text-zinc-400">Duration (turns)</label>
              <input type="number" min={1} className="bg-zinc-800 p-2 rounded text-sm" value={form.duration}
                onChange={e => setForm({ ...form, duration: Number(e.target.value) })} />
              <label className="text-xs text-zinc-400">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-10 h-10 rounded cursor-pointer" value={form.visual_color}
                  onChange={e => setForm({ ...form, visual_color: e.target.value })} />
                <span className="text-xs text-zinc-400">{form.visual_color}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-1 rounded text-sm bg-zinc-700 hover:bg-zinc-600">Cancel</button>
              <button onClick={handleSave} className="px-3 py-1 rounded text-sm bg-amber-600 hover:bg-amber-500">Save</button>
            </div>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-400">
            <th className="py-2 px-2">Icon</th>
            <th className="py-2 px-2">Name</th>
            <th className="py-2 px-2">Effect</th>
            <th className="py-2 px-2">Duration</th>
            <th className="py-2 px-2">Color</th>
            <th className="py-2 px-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {effects.map(e => (
            <tr key={e.id} className="border-b border-zinc-800">
              <td className="py-2 px-2 text-xl">{e.icon}</td>
              <td className="py-2 px-2">{e.name}</td>
              <td className="py-2 px-2 text-zinc-400">{e.effect_per_turn}</td>
              <td className="py-2 px-2">{e.duration}</td>
              <td className="py-2 px-2">
                <span className="inline-block w-6 h-6 rounded" style={{ backgroundColor: e.visual_color }} />
              </td>
              <td className="py-2 px-2 flex gap-2">
                <button onClick={() => handleEdit(e)} className="text-amber-400 hover:text-amber-300">Edit</button>
                <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-300">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
