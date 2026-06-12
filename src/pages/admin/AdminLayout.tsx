import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/admin/monsters',  label: 'Monsters' },
  { to: '/admin/hunters',   label: 'Hunters' },
  { to: '/admin/abilities', label: 'Abilities' },
  { to: '/admin/status',    label: 'Status Effects' },
  { to: '/admin/settings',  label: 'Settings' },
]

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <nav className="w-48 border-r border-zinc-800 p-4 flex flex-col gap-2">
        {links.map(l => (
          <NavLink key={l.to} to={l.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm ${isActive ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`
            }>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-auto p-6"><Outlet /></main>
    </div>
  )
}
