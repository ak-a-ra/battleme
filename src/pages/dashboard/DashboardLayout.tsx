import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/dashboard/lineup', label: 'Lineup' },
  { to: '/dashboard/draft',  label: 'Draft' },
  { to: '/dashboard/battle', label: 'Battle' },
]

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <nav className="w-40 border-r border-zinc-800 p-4 flex flex-col gap-2">
        <h2 className="text-amber-400 font-bold text-sm mb-2">Dashboard</h2>
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
