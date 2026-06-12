import { useEffect, useState } from 'react'
import { api, type Hunter } from '../../lib/invoke'

const CLASSES = ['Fighter', 'Mage', 'Rogue', 'Paladin', 'Ranger', 'Berserker']

const defaultForm = {
  name: '', sprite_id: '', class: 'Fighter',
  hp: 200, mp: 100, str_stat: 15, agi: 15, dex: 15, int_stat: 15, luck: 10,
  lore: '',
}

export default function AdminHunters() {
  const [hunters, setHunters] = useState<Hunter[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(defaultForm)

  const load = async () => {
    const data = await api.getHunters()
    setHunters(data)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    const hunter = {
      name: form.name,
      sprite_id: form.sprite_id || form.name.toLowerCase().replace(/\s+/g, '_'),
      class: form.class,
      hp: form.hp, mp: form.mp,
      str_stat: form.str_stat, agi: form.agi, dex: form.dex,
      int_stat: form.int_stat, luck: form.luck,
      lore: form.lore,
    }
    if (editing && (form as any).id) {
      await api.updateHunter({ ...hunter, id: (form as any).id })
    } else {
      await api.createHunter(hunter)
    }
    setShowForm(false)
    setEditing(false)
    setForm(defaultForm)
    load()
  }

  const handleEdit = (h: Hunter) => {
    setForm({
      name: h.name, sprite_id: h.sprite_id, class: h.class,
      hp: h.hp, mp: h.mp, str_stat: h.str_stat, agi: h.agi, dex: h.dex,
      int_stat: h.int_stat, luck: h.luck, lore: h.lore,
    })
    setEditing(true)
    ;(form as any).id = h.id
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this hunter?')) return
    await api.deleteHunter(id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Hunters</h1>
        <button onClick={() => { setForm(defaultForm); setEditing(false); setShowForm(true) }}
          className="px-3 py-1 bg-amber-600 rounded text-sm hover:bg-amber-500">+ Add Hunter</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-700 w-[500px]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? 'Edit' : 'Add'} Hunter</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <label className="text-xs text-zinc-400">Name</label>
                <input className="bg-zinc-800 p-2 rounded w-full" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-zinc-400">Class</label>
                <select className="bg-zinc-800 p-2 rounded w-full" value={form.class}
                  onChange={e => setForm({ ...form, class: e.target.value })}>
                  {CLASSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400">HP</label>
                <input type="number" className="bg-zinc-800 p-2 rounded w-full" value={form.hp}
                  onChange={e => setForm({ ...form, hp: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-zinc-400">MP</label>
                <input type="number" className="bg-zinc-800 p-2 rounded w-full" value={form.mp}
                  onChange={e => setForm({ ...form, mp: Number(e.target.value) })} />
              </div>
              {(['str_stat', 'agi', 'dex', 'int_stat', 'luck'] as const).map(stat => (
                <div key={stat}>
                  <label className="text-xs text-zinc-400">{stat}</label>
                  <input type="number" className="bg-zinc-800 p-2 rounded w-full" value={form[stat]}
                    onChange={e => setForm({ ...form, [stat]: Number(e.target.value) })} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-zinc-400">Lore</label>
                <textarea className="bg-zinc-800 p-2 rounded w-full text-sm" rows={3} value={form.lore}
                  onChange={e => setForm({ ...form, lore: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-1 rounded text-sm bg-zinc-700">Cancel</button>
              <button onClick={handleSave} className="px-3 py-1 rounded text-sm bg-amber-600 hover:bg-amber-500">Save</button>
            </div>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-400">
            <th className="py-2 px-2">Name</th>
            <th className="py-2 px-2">Class</th>
            <th className="py-2 px-2">HP/MP</th>
            <th className="py-2 px-2">Stats</th>
            <th className="py-2 px-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hunters.map(h => (
            <tr key={h.id} className="border-b border-zinc-800">
              <td className="py-2 px-2">{h.name}</td>
              <td className="py-2 px-2">
                <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{h.class}</span>
              </td>
              <td className="py-2 px-2">{h.hp}/{h.mp}</td>
              <td className="py-2 px-2 text-zinc-400">{h.str_stat}/{h.agi}/{h.dex}/{h.int_stat}/{h.luck}</td>
              <td className="py-2 px-2 flex gap-2">
                <button onClick={() => handleEdit(h)} className="text-amber-400 hover:text-amber-300">Edit</button>
                <button onClick={() => handleDelete(h.id)} className="text-red-400 hover:text-red-300">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
