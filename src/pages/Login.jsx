import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/api'

export default function Login({ user }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else navigate('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-orange rounded-xl text-white font-bold text-xl mb-4">S</div>
          <h1 className="text-xl font-semibold text-txt-primary tracking-widest">SCOUTDEX</h1>
          <p className="text-txt-muted text-sm mt-1">Plateforme de scouting IA</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="card p-6 flex flex-col gap-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input" placeholder="scout@club.fr" required
            />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="input" placeholder="••••••••" required
            />
          </div>

          {error && (
            <div className="text-red-light text-sm bg-red-dim border border-red-light/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2 justify-center">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-txt-muted text-xs mt-4">
          🏀 ScoutDex v1.0
        </p>
      </div>
    </div>
  )
}
