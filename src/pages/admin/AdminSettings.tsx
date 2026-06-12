import { useEffect, useState } from 'react'
import { api } from '../../lib/invoke'

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then((data: any) => setSettings(data as Record<string, string>))
  }, [])

  const handleSave = async () => {
    await api.saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const copyObsUrl = () => {
    navigator.clipboard.writeText('http://localhost:3000/overlay')
  }

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Settings</h1>

      <div className="flex flex-col gap-4 max-w-lg">
        <div>
          <label className="text-xs text-zinc-400 block mb-1">TWITCH_CLIENT_ID</label>
          <input className="bg-zinc-800 p-2 rounded text-sm w-full" value={settings['TWITCH_CLIENT_ID'] || ''}
            onChange={e => handleChange('TWITCH_CLIENT_ID', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">TWITCH_CLIENT_SECRET</label>
          <input type="password" className="bg-zinc-800 p-2 rounded text-sm w-full" value={settings['TWITCH_CLIENT_SECRET'] || ''}
            onChange={e => handleChange('TWITCH_CLIENT_SECRET', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">TWITCH_CHANNEL_NAME</label>
          <input className="bg-zinc-800 p-2 rounded text-sm w-full" value={settings['TWITCH_CHANNEL_NAME'] || ''}
            onChange={e => handleChange('TWITCH_CHANNEL_NAME', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">ANTHROPIC_API_KEY</label>
          <input type="password" className="bg-zinc-800 p-2 rounded text-sm w-full" value={settings['ANTHROPIC_API_KEY'] || ''}
            onChange={e => handleChange('ANTHROPIC_API_KEY', e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave}
            className="px-4 py-2 bg-amber-600 rounded text-sm hover:bg-amber-500">
            {saved ? '✓ Saved' : 'Save'}
          </button>
          <button onClick={copyObsUrl}
            className="px-4 py-2 bg-zinc-700 rounded text-sm hover:bg-zinc-600">
            Copy OBS URL
          </button>
        </div>
      </div>
    </div>
  )
}
