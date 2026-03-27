import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { getBadgeClass, gradeColor, fmt, STATUTS, POSTES, LIGUES, LEAGUE_COLOR, posteStyle } from '../lib/utils'

export default function Players() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ league: '', status: '', position: '', search: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    const data = await api.getPlayers(params).catch(() => [])
    setPlayers(data || [])
    setLoading(false)
  }, [filters])

  useEffect(() => { load() }, [load])

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-base font-semibold text-txt-primary">Joueurs</h1>
          <p className="text-xs text-txt-muted">{players.length} joueur{players.length > 1 ? 's' : ''}</p>
        </div>
        <Link to="/players/new" className="btn-primary text-xs ml-auto">+ Ajouter</Link>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          className="input w-52 text-xs"
          placeholder="Rechercher..."
        />
        <select value={filters.league} onChange={e => setFilter('league', e.target.value)} className="select w-40 text-xs">
          <option value="">Toutes les ligues</option>
          {LIGUES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filters.position} onChange={e => setFilter('position', e.target.value)} className="select w-32 text-xs">
          <option value="">Tous postes</option>
          {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className="select w-44 text-xs">
          <option value="">Tous statuts</option>
          {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {Object.values(filters).some(v => v) && (
          <button onClick={() => setFilters({ league: '', status: '', position: '', search: '' })} className="btn-ghost text-xs">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-bg-border">
              {['Joueur', 'Pos', 'Ligue', 'Équipe', 'PTS', 'REB', 'AST', 'BPM', 'TS%', 'USG%', 'Note', 'Statut', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-txt-muted uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} className="px-4 py-10 text-center text-txt-muted animate-pulse">Chargement...</td></tr>
            ) : players.length === 0 ? (
              <tr><td colSpan={13} className="px-4 py-10 text-center text-txt-muted">
                Aucun joueur trouvé — <Link to="/players/new" className="text-orange hover:underline">en ajouter un</Link>
              </td></tr>
            ) : players.map(p => (
              <tr key={p.id} className="border-b border-bg-border/40 hover:bg-bg-card transition-colors group">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {p.photo_url
                      ? <img src={p.photo_url} alt="" className="w-7 h-7 rounded-full object-cover bg-bg-border" />
                      : <div className="w-7 h-7 rounded-full bg-bg-border flex items-center justify-center text-txt-muted text-[10px] font-medium">
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                    }
                    <Link to={`/players/${p.id}`} className="font-medium text-txt-primary hover:text-orange transition-colors whitespace-nowrap">
                      {p.first_name} {p.last_name}
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${posteStyle(p.position)}`}>
                    {p.position || '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span style={{ color: LEAGUE_COLOR[p.league] || '#888' }} className="text-[11px] font-medium">
                    {p.league || '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-txt-secondary whitespace-nowrap">{p.team || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-txt-primary">{fmt(p.pts)}</td>
                <td className="px-3 py-2.5 font-mono text-txt-secondary">{fmt(p.reb)}</td>
                <td className="px-3 py-2.5 font-mono text-txt-secondary">{fmt(p.ast)}</td>
                <td className={`px-3 py-2.5 font-mono ${p.bpm >= 0 ? 'text-teal-light' : p.bpm < 0 ? 'text-red-light' : 'text-txt-secondary'}`}>
                  {p.bpm != null ? (p.bpm >= 0 ? '+' : '') + fmt(p.bpm) : '—'}
                </td>
                <td className="px-3 py-2.5 font-mono text-txt-secondary">{fmt(p.ts_pct)}</td>
                <td className="px-3 py-2.5 font-mono text-txt-secondary">{fmt(p.usg_pct)}</td>
                <td className="px-3 py-2.5">
                  <span className={`font-bold text-sm ${gradeColor(p.scout_grade)}`}>{p.scout_grade ?? '—'}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={getBadgeClass(p.status)}>{p.status || '—'}</span>
                </td>
                <td className="px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/players/${p.id}`} className="text-orange text-[11px] hover:underline whitespace-nowrap">
                    Voir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
