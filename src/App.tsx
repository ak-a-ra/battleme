import { Outlet, Link } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <nav className="flex items-center gap-4 border-b border-neutral-700 px-4 py-2">
        <Link to="/" className="font-bold text-lg">BattleMe</Link>
        <Link to="/dashboard" className="text-sm hover:text-amber-400">Dashboard</Link>
        <Link to="/wiki" className="text-sm hover:text-amber-400">Wiki</Link>
        <Link to="/admin" className="text-sm hover:text-amber-400">Admin</Link>
        <Link to="/history" className="text-sm hover:text-amber-400">History</Link>
        <Link to="/stats" className="text-sm hover:text-amber-400">Stats</Link>
        <Link to="/overlay" className="text-sm hover:text-amber-400">Overlay</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
