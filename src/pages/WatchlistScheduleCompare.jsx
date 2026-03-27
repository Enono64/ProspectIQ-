import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { getBadgeClass, gradeColor, fmt, LEAGUE_COLOR, posteStyle } from '../lib/utils'

export function Watchlist() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getWatchlist().then(setPlayers).finally(() => setLoading(false))
  }, [])

  async function remove(id) {
    await api.removeWatchlist(id)
    setPlayers(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <h1 className="text-base font-semibold text-txt-primary">Watchlist</h1>
        <p className="text-xs text-txt-muted">{players.length} joueur{players.length > 1 ? 's' : ''} en veille active</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-bg-border">
              {['Joueur', 'Pos', 'Ligue', 'Note', 'Statut', 'Ajouté le', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-txt-muted uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-txt-muted animate-pulse">Chargement...</td></tr>
            ) : players.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-txt-muted">
                Watchlist vide — ajoute des joueurs depuis leur fiche
              </td></tr>
            ) : players.map(p => (
              <tr key={p.id} className="border-b border-bg-border/40 hover:bg-bg-card transition-colors">
                <td className="px-4 py-2.5">
                  <Link to={`/players/${p.id}`} className="font-medium text-txt-primary hover:text-orange">
                    {p.first_name} {p.last_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${posteStyle(p.position)}`}>{p.position || '—'}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span style={{ color: LEAGUE_COLOR[p.league] || '#888' }} className="text-[11px]">{p.league || '—'}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`font-bold text-sm ${gradeColor(p.scout_grade)}`}>{p.scout_grade}</span>
                </td>
                <td className="px-4 py-2.5"><span className={getBadgeClass(p.status)}>{p.status}</span></td>
                <td className="px-4 py-2.5 text-txt-muted">{p.watchlisted_at ? new Date(p.watchlisted_at).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => remove(p.id)} className="text-txt-muted hover:text-red-light text-xs transition-colors">Retirer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Schedule() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSchedule().then(setGames).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <h1 className="text-base font-semibold text-txt-primary">Calendrier</h1>
        <p className="text-xs text-txt-muted">Matchs des 7 prochains jours</p>
      </div>
      {loading ? (
        <div className="text-txt-muted text-sm animate-pulse p-10 text-center">Chargement...</div>
      ) : games.length === 0 ? (
        <div className="card p-10 text-center text-txt-muted text-sm">Aucun match à venir</div>
      ) : (
        <div className="flex flex-col gap-2">
          {games.map(g => (
            <div key={g.schedule?.id} className="card p-3 flex items-center gap-4">
              <div className="text-xs text-txt-muted w-20">{new Date(g.schedule?.game_date).toLocaleDateString('fr-FR')}</div>
              <div className="font-medium text-sm text-txt-primary">
                <Link to={`/players/${g.players?.id}`} className="hover:text-orange">{g.players?.first_name} {g.players?.last_name}</Link>
              </div>
              <div className="text-xs text-txt-muted">{g.schedule?.team_name} vs {g.schedule?.opponent}</div>
              <div className="text-xs ml-auto" style={{ color: LEAGUE_COLOR[g.players?.league] || '#888' }}>{g.players?.league}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Compare() {
  const [allPlayers, setAllPlayers] = useState([])
  const [selected, setSelected]     = useState([])
  const [result, setResult]         = useState(null)
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    api.getPlayers().then(setAllPlayers)
  }, [])

  function toggle(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 4 ? [...s, id] : s)
  }

  async function compare() {
    if (selected.length < 2) return
    setLoading(true)
    const data = await api.comparePlayers(selected).catch(() => null)
    setResult(data)
    setLoading(false)
  }

  const STATS = [
    ['PTS', 'pts'], ['REB', 'reb'], ['AST', 'ast'], ['STL', 'stl'],
    ['BLK', 'blk'], ['FG%', 'fg_pct'], ['3P%', 'fg3_pct'], ['FT%', 'ft_pct'],
    ['TS%', 'ts_pct'], ['USG%', 'usg_pct'], ['BPM', 'bpm'], ['VORP', 'vorp'],
    ['PER', 'per'], ['ORTG', 'ortg'], ['DRTG', 'drtg'],
  ]

  const players = result?.players || []

  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <h1 className="text-base font-semibold text-txt-primary">Comparaison</h1>
        <p className="text-xs text-txt-muted">Sélectionne 2 à 4 joueurs</p>
      </div>

      {/* Sélection */}
      <div className="card p-4">
        <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">
          Joueurs sélectionnés ({selected.length}/4)
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {allPlayers.map(p => (
            <button key={p.id} onClick={() => toggle(p.id)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                selected.includes(p.id)
                  ? 'bg-orange text-white border-orange'
                  : 'bg-bg-card text-txt-secondary border-bg-border hover:border-orange/50'
              }`}>
              {p.first_name} {p.last_name}
            </button>
          ))}
        </div>
        <button onClick={compare} disabled={selected.length < 2 || loading} className="btn-primary text-xs">
          {loading ? 'Analyse IA...' : '⇄ Comparer'}
        </button>
      </div>

      {/* Résultats */}
      {players.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-bg-border">
                <th className="px-4 py-3 text-left text-txt-muted uppercase tracking-wider">Stat</th>
                {players.map(p => (
                  <th key={p.id} className="px-4 py-3 text-center text-txt-primary font-medium">
                    {p.first_name} {p.last_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STATS.map(([label, key], i) => {
                const vals = players.map(p => p[key])
                const max = Math.max(...vals.filter(v => v != null))
                return (
                  <tr key={key} className={`border-b border-bg-border/40 ${i % 2 === 0 ? '' : 'bg-bg-card/30'}`}>
                    <td className="px-4 py-2.5 text-txt-muted uppercase tracking-wider">{label}</td>
                    {players.map(p => (
                      <td key={p.id} className={`px-4 py-2.5 text-center font-mono ${
                        p[key] === max && max != null ? 'text-teal-light font-semibold' : 'text-txt-secondary'
                      }`}>
                        {fmt(p[key])}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Analyse IA */}
      {result?.analysis && (
        <div className="card p-4 border-purple-border bg-purple-dim/20">
          <div className="text-xs text-purple-light uppercase tracking-widest mb-3">Analyse comparative IA</div>
          <p className="text-sm text-txt-secondary leading-relaxed whitespace-pre-wrap">{result.analysis}</p>
        </div>
      )}
    </div>
  )
}
