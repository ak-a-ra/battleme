import { useState, useEffect } from 'react'
import { api } from '../../lib/invoke'

interface MonsterFormData {
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
}

interface Props {
  initial?: Partial<MonsterFormData> & { id?: number }
  onClose: () => void
  onSaved: () => void
}

const TYPES = ['Fire', 'Water', 'Earth', 'Wind', 'Dark', 'Light']

const defaultForm: MonsterFormData = {
  name: '', sprite_id: '', monster_type: 'Fire',
  hp: 100, mp: 50, str_stat: 10, agi: 10, dex: 10, int_stat: 10, luck: 10,
  lore: '',
}

export default function MonsterForm({ initial, onClose, onSaved }: Props) {
  const editing = !!initial?.id
  const [form, setForm] = useState<MonsterFormData>({ ...defaultForm, ...initial })
  const [generating, setGenerating] = useState(false)
  const [generatedByLlm, setGeneratedByLlm] = useState(false)

  // Reset generatedByLlm when initial data changes (new monster or edit different monster)
  useEffect(() => {
    setGeneratedByLlm(false)
  }, [initial?.id])

  const handleChange = (key: keyof MonsterFormData, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleGenerate = async () => {
    if (!form.name) return
    setGenerating(true)
    try {
      const stats = await api.generateMonsterStats(form.name, form.monster_type)
      // Only fill stats/lore — abilities discarded per grill decision
      if (stats.hp) setForm(prev => ({ ...prev, hp: stats.hp }))
      if (stats.mp) setForm(prev => ({ ...prev, mp: stats.mp }))
      if (stats.str_stat) setForm(prev => ({ ...prev, str_stat: stats.str_stat }))
      if (stats.agi) setForm(prev => ({ ...prev, agi: stats.agi }))
      if (stats.dex) setForm(prev => ({ ...prev, dex: stats.dex }))
      if (stats.int_stat) setForm(prev => ({ ...prev, int_stat: stats.int_stat }))
      if (stats.luck) setForm(prev => ({ ...prev, luck: stats.luck }))
      if (stats.lore) setForm(prev => ({ ...prev, lore: stats.lore }))
      setGeneratedByLlm(true)
    } catch (err) {
      alert(`Generate failed: ${err}`)
    }
    setGenerating(false)
  }

  const handleSave = async () => {
    const monster = {
      name: form.name,
      sprite_id: form.sprite_id || form.name.toLowerCase().replace(/\s+/g, '_'),
      monster_type: form.monster_type,
      hp: form.hp, mp: form.mp,
      str_stat: form.str_stat, agi: form.agi, dex: form.dex,
      int_stat: form.int_stat, luck: form.luck,
      lore: form.lore,
      generated_by_llm: generatedByLlm,
    }
    if (editing && initial?.id) {
      await api.updateMonster({ ...monster, id: initial.id })
    } else {
      await api.createMonster(monster)
    }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-700 w-[500px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{editing ? 'Edit' : 'Add'} Monster</h2>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <label className="text-xs text-zinc-400">Name</label>
            <input className="bg-zinc-800 p-2 rounded w-full" value={form.name}
              onChange={e => handleChange('name', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Sprite ID</label>
            <input className="bg-zinc-800 p-2 rounded w-full" value={form.sprite_id}
              onChange={e => handleChange('sprite_id', e.target.value)} placeholder="auto-filled" />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Type</label>
            <select className="bg-zinc-800 p-2 rounded w-full" value={form.monster_type}
              onChange={e => handleChange('monster_type', e.target.value)}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {(['hp', 'mp', 'str_stat', 'agi', 'dex', 'int_stat', 'luck'] as const).map(stat => (
            <div key={stat}>
              <label className="text-xs text-zinc-400">{stat}</label>
              <input type="number" className="bg-zinc-800 p-2 rounded w-full" value={form[stat]}
                onChange={e => handleChange(stat, Number(e.target.value))} />
            </div>
          ))}
          <div className="col-span-2">
            <label className="text-xs text-zinc-400">Lore</label>
            <textarea className="bg-zinc-800 p-2 rounded w-full text-sm" rows={3} value={form.lore}
              onChange={e => handleChange('lore', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 mt-4 justify-between">
          <button onClick={handleGenerate} disabled={generating || !form.name}
            className="px-3 py-1 rounded text-sm bg-purple-700 hover:bg-purple-600 disabled:opacity-50">
            {generating ? 'Generating...' : 'Generate Stats'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1 rounded text-sm bg-zinc-700 hover:bg-zinc-600">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1 rounded text-sm bg-amber-600 hover:bg-amber-500">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
