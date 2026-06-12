import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/wiki/monsters',       label: '🐉 Monsters' },
  { to: '/wiki/hunters',        label: '⚔️ Hunters' },
  { to: '/wiki/status-effects', label: '💥 Status Effects' },
  { to: '/wiki/types',          label: '🗺️ Type Chart' },
]

export default function WikiLayout() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Wiki</h1>
      <nav className="flex gap-1 border-b border-zinc-700 mb-6">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) =>
              `px-4 py-2 text-sm rounded-t transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-amber-400 border-b-2 border-amber-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
