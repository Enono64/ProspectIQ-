import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/api'

const NAV = [
  { to: '/',         icon: '⊞', label: 'Dashboard' },
  { to: '/players',  icon: '◉', label: 'Joueurs' },
  { to: '/watchlist',icon: '★', label: 'Watchlist' },
  { to: '/schedule', icon: '◈', label: 'Calendrier' },
  { to: '/pipeline', icon: '⊟', label: 'Pipeline' },
  { to: '/profiles', icon: '🏢', label: 'Profils équipe' },
  { to: '/compare',  icon: '⇄', label: 'Comparer' },
]

export default function Layout({ user }) {
  const navigate = useNavigate()
  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }
  const initial = user?.email?.[0]?.toUpperCase() || 'S'

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <aside className="w-14 bg-bg-surface border-r border-bg-border flex flex-col items-center py-3 gap-1 flex-shrink-0">
        <div className="w-8 h-8 bg-acc rounded-lg flex items-center justify-center text-white font-bold text-sm mb-3 font-display">P</div>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} title={label}
            className={({ isActive }) =>
              `w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all duration-150
               ${isActive
                 ? 'bg-bg-hover text-acc border border-bg-border2'
                 : 'text-txt-muted hover:bg-bg-card hover:text-txt-secondary'
               }`
            }
          >
            {icon}
          </NavLink>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2">
          <button onClick={handleLogout} title="Déconnexion"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-txt-muted hover:bg-bg-card hover:text-red transition-colors text-sm">
            ⏏
          </button>
          <div className="w-7 h-7 rounded-full bg-acc flex items-center justify-center text-white font-bold text-xs">
            {initial}
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
