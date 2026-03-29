import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const API = import.meta.env.VITE_API_URL

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
  }
}

async function request(method, path, body = null) {
  const headers = await getHeaders()
  const resp = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })
  if (resp.status === 204) return null
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Erreur serveur')
  return data
}

export const api = {
  // Joueurs
  getPlayers:    (params = {}) => request('GET', '/players?' + new URLSearchParams(params)),
  getPlayer:     (id)          => request('GET', `/players/${id}`),
  createPlayer:  (body)        => request('POST', '/players', body),
  updatePlayer:  (id, body)    => request('PATCH', `/players/${id}`, body),
  deletePlayer:  (id)          => request('DELETE', `/players/${id}`),
  autofill:      (name, league)=> request('POST', '/players/autofill', { name, league }),
  syncPlayer:    (id)          => request('POST', `/players/${id}/sync`),
  comparePlayers:(ids)         => request('POST', '/players/compare', { playerIds: ids }),

  // Rapports
  createReport:  (id, body)    => request('POST', `/players/${id}/reports`, body),
  generateAIReport:(id)        => request('POST', `/players/${id}/reports/ai`),
  updateReport:  (id, body)    => request('PATCH', `/reports/${id}`, body),
  deleteReport:  (id)          => request('DELETE', `/reports/${id}`),

  // Watchlist
  getWatchlist:  ()            => request('GET', '/watchlist'),
  addWatchlist:  (id, note)    => request('POST', `/watchlist/${id}`, { note }),
  removeWatchlist:(id)         => request('DELETE', `/watchlist/${id}`),

  // Saisons multi-ligues
  getSeasons:    (id)           => request('GET', `/players/${id}/seasons`),
  createSeason:  (id, body)     => request('POST', `/players/${id}/seasons`, body),
  updateSeason:  (sid, body)    => request('PATCH', `/seasons/${sid}`, body),
  deleteSeason:  (sid)          => request('DELETE', `/seasons/${sid}`),

  // Barttorvik & KenPom
  syncBarttorvik: (id)              => request('POST', `/players/${id}/sync-barttorvik`),
  syncKenpom:     (id, team, u, p)  => request('POST', `/players/${id}/sync-kenpom`, { team, kenpom_user: u, kenpom_pass: p }),
  searchBarttorvik:(name, team)     => request('GET', `/barttorvik/search?name=${encodeURIComponent(name)}${team ? '&team=' + encodeURIComponent(team) : ''}`),

  // Dashboard & admin
  getDashboard:  ()            => request('GET', '/dashboard'),
  getSchedule:   (params = {}) => request('GET', '/schedule?' + new URLSearchParams(params)),
  syncAll:       ()            => request('POST', '/admin/sync-all'),
  getSyncLogs:   ()            => request('GET', '/admin/sync-logs'),
}
