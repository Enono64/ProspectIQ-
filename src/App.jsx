import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/api'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Players from './pages/Players'
import PlayerDetail from './pages/PlayerDetail'
import PlayerNew from './pages/PlayerNew'
import TeamProfiles from './pages/TeamProfiles'
import Pipeline from './pages/Pipeline'
import Veille from './pages/Veille'
import { Watchlist, Schedule, Compare } from './pages/WatchlistScheduleCompare'

function PrivateRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-acc font-bold tracking-widest text-sm animate-pulse">PROSPECTIQ</div>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login user={user} />} />
        <Route path="/" element={
          <PrivateRoute user={user}>
            <Layout user={user} />
          </PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="players" element={<Players />} />
          <Route path="players/new" element={<PlayerNew />} />
          <Route path="players/:id" element={<PlayerDetail />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="compare" element={<Compare />} />
          <Route path="profiles" element={<TeamProfiles />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="veille" element={<Veille />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
