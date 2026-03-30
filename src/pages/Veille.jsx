import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { LEAGUE_COLOR } from '../lib/utils'

const LEAGUES = ['BBL (GER)', 'Pro A (GER)', 'Betclic Elite', 'Pro B', 'Liga ACB (ESP)', 'Lega A (ITA)', 'BSL (TUR)', 'EuroLeague', 'BCL', 'NCAA']

export default function Veille() {
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 2)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo]     = useState(() => new Date().toISOString().split('T')[0])
  const [selectedLeagues, setSelectedLeagues] = useState(LEAGUES)
  const [importing, setImporting] = useState({})

  function toggleLeague(l) {
    setSelectedLeagues(prev =>
      prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
    )
  }

  async function handleSearch() {
    setLoading(true); setError(''); setResult(null)
    try {
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
        leagues: selectedLeagues.join(',')
      })
      const data = await fetch(
        import.meta.env.VITE_API_URL + '/synergy/veille?' + params,
        { headers: { Authorization: 'Bearer ' + (await getToken()) } }
      ).then(r => r.json())
      if (!data.ok) throw new Error(data.error)
      setResult(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function getToken() {
    const { supabase } = await import('../lib/api')
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  async function handleImport(perf) {
    setImporting(prev => ({ ...prev, [perf.player_name]: true }))
    try {
      const res = await api.autofill(perf.player_name, perf.league)
      if (res.player) {
        await api.createPlayer({ ...res.player, status: '🟡 À SURVEILLER', observation: 'Importé depuis veille ' + perf.date + ' — ' + perf.pts + 'pts ' + perf.reb + 'reb ' + perf.ast + 'ast (Eval: ' + perf.eval + ')' })
        setImporting(prev => ({ ...prev, [perf.player_name]: 'done' }))
      }
    } catch (e) {
      alert('Erreur : ' + e.message)
      setImporting(prev => ({ ...prev, [perf.player_name]: false }))
    }
  }

  async function handleTestAPI() {
    try {
      const { supabase } = await import('../lib/api')
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token || ''
      const resp = await fetch(import.meta.env.VITE_API_URL + '/synergy/test', {
        headers: { Authorization: 'Bearer ' + token }
      }).then(r => r.json())
      const lines = Object.entries(resp).map(([league, r]) =>
        (r.ok ? '✅' : '❌') + ' ' + league + ' (' + r.slug + ')' + (r.error ? ' — ' + r.error : '')
      ).join('\n')
      alert('Synergy — Ligues disponibles :\n\n' + lines)
    } catch (e) { alert('❌ ' + e.message) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-[50px] bg-bg-surface border-b border-bg-border flex items-center px-5 gap-4 flex-shrink-0">
        <div>
          <div className="text-sm font-bold tracking-wider text-txt-primary">Veille hebdomadaire</div>
          <div className="text-[10px] text-txt-muted">Meilleures performances du week-end · Agent IA</div>
        </div>
        <button onClick={handleTestAPI} className="ml-auto btn-ghost text-xs py-1">
          🔌 Tester API
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-4xl">

        {/* Filtres */}
        <div className="card p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Du</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-xs mono" />
            </div>
            <div>
              <label className="label">Au</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-xs mono" />
            </div>
          </div>
          <div>
            <label className="label">Ligues</label>
            <div className="flex flex-wrap gap-1.5">
              {LEAGUES.map(l => (
                <button key={l} onClick={() => toggleLeague(l)}
                  className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
                    selectedLeagues.includes(l)
                      ? 'border-acc/40 bg-acc/10 text-acc'
                      : 'border-bg-border2 bg-bg-hover text-txt-muted'
                  }`} style={selectedLeagues.includes(l) ? { borderColor: (LEAGUE_COLOR[l] || '#ff4500') + '60', color: LEAGUE_COLOR[l] || '#ff4500', background: (LEAGUE_COLOR[l] || '#ff4500') + '15' } : {}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSearch} disabled={loading || selectedLeagues.length === 0} className="btn-primary text-xs">
            {loading ? '🔍 Analyse en cours...' : '🔍 Lancer la veille'}
          </button>
        </div>

        {error && <div className="text-red text-xs bg-red/5 border border-red/20 rounded-lg p-3">{error}</div>}

        {loading && (
          <div className="card p-8 text-center">
            <div className="text-2xl mb-3 animate-pulse">🏀</div>
            <div className="text-sm text-txt-secondary">Analyse des box scores en cours...</div>
            <div className="text-xs text-txt-muted mt-1">Récupération des matchs · Filtrage des perfs · Analyse IA</div>
          </div>
        )}

        {result && (
          <>
            {/* Analyse IA */}
            <div className="card p-4 border-purple/20 bg-purple/5">
              <div className="text-[10px] text-purple uppercase tracking-widest mb-3">
                🤖 Analyse scout IA — {result.dateFrom} → {result.dateTo} · {result.total} performances analysées
              </div>
              <p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{result.analysis}</p>
            </div>

            {/* Box scores */}
            {result.perfs.length > 0 && (
              <div className="card p-4">
                <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">
                  Top performances — {result.perfs.length} joueurs
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-bg-border">
                        <th className="text-left px-2 py-2 text-[9px] text-txt-muted uppercase">Joueur</th>
                        <th className="text-left px-2 py-2 text-[9px] text-txt-muted uppercase">Ligue</th>
                        <th className="text-left px-2 py-2 text-[9px] text-txt-muted uppercase">Match</th>
                        <th className="text-center px-2 py-2 text-[9px] text-txt-muted uppercase">PTS</th>
                        <th className="text-center px-2 py-2 text-[9px] text-txt-muted uppercase">REB</th>
                        <th className="text-center px-2 py-2 text-[9px] text-txt-muted uppercase">AST</th>
                        <th className="text-center px-2 py-2 text-[9px] text-txt-muted uppercase">EVAL</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.perfs.map((p, i) => (
                        <tr key={i} className="border-b border-bg-border/40 hover:bg-bg-hover/50 transition-colors">
                          <td className="px-2 py-2">
                            <div className="font-semibold text-txt-primary">{p.player_name}</div>
                            <div className="text-[10px] text-txt-muted">{p.team}</div>
                          </td>
                          <td className="px-2 py-2">
                            <span className="text-[10px] font-medium" style={{ color: LEAGUE_COLOR[p.league] || '#888' }}>{p.league}</span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="text-[10px] text-txt-secondary">{p.match}</div>
                            <div className="text-[9px] text-txt-muted">{p.date}</div>
                          </td>
                          <td className="px-2 py-2 text-center mono font-semibold text-teal">{p.pts}</td>
                          <td className="px-2 py-2 text-center mono text-txt-secondary">{p.reb}</td>
                          <td className="px-2 py-2 text-center mono text-txt-secondary">{p.ast}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`mono text-xs font-bold ${p.eval >= 30 ? 'text-teal' : p.eval >= 20 ? 'text-amber' : 'text-txt-secondary'}`}>
                              {p.eval}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {importing[p.player_name] === 'done' ? (
                              <span className="text-[10px] text-teal">✅ Importé</span>
                            ) : (
                              <button
                                onClick={() => handleImport(p)}
                                disabled={importing[p.player_name] === true}
                                className="text-[10px] text-acc hover:underline disabled:opacity-50"
                              >
                                {importing[p.player_name] ? '...' : '+ Ajouter'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
