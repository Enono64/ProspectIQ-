import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/api'

const NAV = [
  { to: '/',         icon: '⊞', label: 'Dashboard' },
  { to: '/players',  icon: '◉', label: 'Joueurs' },
  { to: '/watchlist',icon: '★', label: 'Watchlist' },
  { to: '/schedule', icon: '◈', label: 'Calendrier' },
  { to: '/compare',  icon: '⇄', label: 'Comparer' },
]

export default function Layout({ user }) {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">

      {/* Sidebar */}
      <aside className="w-14 bg-bg-surface border-r border-bg-border flex flex-col items-center py-4 gap-2 flex-shrink-0">
        {/* Logo */}
        <div className="w-8 h-8 bg-orange rounded-lg flex items-center justify-center text-white font-bold text-sm mb-3">
          S
        </div>

        {/* Nav */}
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} title={label}
            className={({ isActive }) =>
              `w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors
               ${isActive
                 ? 'bg-purple-dim text-purple-light'
                 : 'text-txt-muted hover:bg-bg-card hover:text-txt-secondary'
               }`
            }
          >
            {icon}
          </NavLink>
        ))}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Déconnexion"
          className="mt-auto w-9 h-9 rounded-lg flex items-center justify-center text-txt-muted hover:bg-bg-card hover:text-red-light transition-colors"
        >
          ⏏
        </button>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
