import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { getBadgeClass, gradeColor, fmt, fmtDate, LEAGUE_COLOR, STATUTS, POSTES, LIGUES } from '../lib/utils'

function StatBox({ label, value, color = '' }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-3 text-center">
      <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-xl font-semibold font-mono ${color || 'text-txt-primary'}`}>{value ?? '—'}</div>
    </div>
  )
}

export default function PlayerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [tab, setTab]           = useState('stats')
  const [editing, setEditing]   = useState(false)
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const data = await api.getPlayer(id).catch(() => null)
    setPlayer(data)
    setForm(data || {})
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    await api.syncPlayer(id).catch(console.error)
    setTimeout(load, 3000)
    setSyncing(false)
  }

  async function handleAIReport() {
    setAiLoading(true)
    await api.generateAIReport(id).catch(e => alert(e.message))
    await load()
    setTab('reports')
    setAiLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== '' && v !== null && !Array.isArray(v) && typeof v !== 'object')
    )
    await api.updatePlayer(id, payload).catch(e => alert(e.message))
    await load()
    setEditing(false)
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce joueur ? Cette action est irréversible.')) return
    await api.deletePlayer(id)
    navigate('/players')
  }

  async function handleDeleteReport(rid) {
    if (!confirm('Supprimer ce rapport ?')) return
    await api.deleteReport(rid)
    await load()
  }

  async function handleWatchlist() {
    if (player.watchlisted) await api.removeWatchlist(id)
    else await api.addWatchlist(id)
    await load()
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  if (loading) return <div className="p-10 text-txt-muted text-sm animate-pulse text-center">Chargement...</div>
  if (!player)  return <div className="p-10 text-red-light text-sm text-center">Joueur introuvable</div>

  const reports = player.reports || []

  return (
    <div className="p-5 flex flex-col gap-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost text-xs mt-1">← Retour</button>

        {/* Photo */}
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-bg-card border border-bg-border flex-shrink-0">
          {player.photo_url
            ? <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-txt-muted font-bold text-lg">
                {player.first_name?.[0]}{player.last_name?.[0]}
              </div>
          }
        </div>

        {/* Infos */}
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-txt-primary">
              {player.first_name} {player.last_name}
            </h1>
            {player.position && (
              <span className="px-2 py-0.5 rounded bg-purple-dim text-purple-light text-xs font-medium">{player.position}</span>
            )}
            <span className={getBadgeClass(player.status)}>{player.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {player.team && <span className="text-sm text-txt-secondary">{player.team}</span>}
            {player.league && (
              <span className="text-sm font-medium" style={{ color: LEAGUE_COLOR[player.league] || '#888' }}>
                {player.league}
              </span>
            )}
            {player.age && <span className="text-xs text-txt-muted">{player.age} ans</span>}
            {player.height_cm && <span className="text-xs text-txt-muted">{player.height_cm} cm</span>}
            {player.nationality && <span className="text-xs text-txt-muted">{player.nationality}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-txt-muted">Note scout :</span>
            <span className={`text-base font-bold ${gradeColor(player.scout_grade)}`}>{player.scout_grade}/10</span>
            {player.ceiling && <span className="text-xs text-orange ml-2">Plafond : {player.ceiling}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={handleWatchlist} className={`btn-ghost text-xs ${player.watchlisted ? 'text-amber-light border-amber-light/30' : ''}`}>
            {player.watchlisted ? '★ Watchlist' : '☆ Watchlist'}
          </button>
          <button onClick={handleSync} disabled={syncing} className="btn-ghost text-xs">
            {syncing ? '⟳ Sync...' : '⟳ Sync stats'}
          </button>
          <button onClick={handleAIReport} disabled={aiLoading} className="btn-primary text-xs">
            {aiLoading ? '🤖 Génération...' : '🤖 Rapport IA'}
          </button>
          <button onClick={() => setEditing(!editing)} className="btn-ghost text-xs">
            {editing ? 'Annuler' : '✏️ Modifier'}
          </button>
          <button onClick={handleDelete} className="btn-danger text-xs">Supprimer</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bg-border pb-0">
        {[['stats', 'Statistiques'], ['scout', 'Scout'], ['reports', `Rapports (${reports.length})`], ['edit', 'Modifier']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'text-orange border-orange'
                : 'text-txt-muted border-transparent hover:text-txt-secondary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab Stats */}
      {tab === 'stats' && (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-txt-muted uppercase tracking-widest">
            Stats — {player.season || '2024-25'}
            {player.last_synced_at && <span className="ml-2 normal-case">· Sync {fmtDate(player.last_synced_at)}</span>}
          </div>

          {/* Stats de base */}
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
            <StatBox label="PTS"  value={fmt(player.pts)} />
            <StatBox label="REB"  value={fmt(player.reb)} />
            <StatBox label="AST"  value={fmt(player.ast)} />
            <StatBox label="STL"  value={fmt(player.stl)} />
            <StatBox label="BLK"  value={fmt(player.blk)} />
            <StatBox label="TOV"  value={fmt(player.tov)} />
            <StatBox label="FG%"  value={fmt(player.fg_pct)} />
            <StatBox label="3P%"  value={fmt(player.fg3_pct)} />
            <StatBox label="FT%"  value={fmt(player.ft_pct)} />
          </div>

          {/* Stats avancées */}
          <div className="text-xs text-txt-muted uppercase tracking-widest mt-2">Stats avancées</div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            <StatBox label="TS%"  value={fmt(player.ts_pct)}  color="text-teal-light" />
            <StatBox label="eFG%" value={fmt(player.efg_pct)} color="text-teal-light" />
            <StatBox label="USG%" value={fmt(player.usg_pct)} />
            <StatBox label="PER"  value={fmt(player.per)} />
            <StatBox label="BPM"  value={player.bpm != null ? (player.bpm >= 0 ? '+' : '') + fmt(player.bpm) : '—'} color={player.bpm >= 0 ? 'text-teal-light' : 'text-red-light'} />
            <StatBox label="OBPM" value={player.obpm != null ? (player.obpm >= 0 ? '+' : '') + fmt(player.obpm) : '—'} />
            <StatBox label="DBPM" value={player.dbpm != null ? (player.dbpm >= 0 ? '+' : '') + fmt(player.dbpm) : '—'} />
            <StatBox label="VORP" value={fmt(player.vorp)} color="text-purple-light" />
            <StatBox label="ORTG" value={fmt(player.ortg, 0)} />
            <StatBox label="DRTG" value={fmt(player.drtg, 0)} />
            <StatBox label="Net"  value={player.net_rtg != null ? (player.net_rtg >= 0 ? '+' : '') + fmt(player.net_rtg) : '—'} color={player.net_rtg >= 0 ? 'text-teal-light' : 'text-red-light'} />
            <StatBox label="AST/TO" value={fmt(player.ast_to, 2)} />
          </div>

          {/* Liens */}
          {(player.bref_url || player.eurobasket_url || player.highlight_url) && (
            <div className="flex gap-2 flex-wrap mt-2">
              {player.bref_url && <a href={player.bref_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">Basketball-Reference ↗</a>}
              {player.eurobasket_url && <a href={player.eurobasket_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">Eurobasket ↗</a>}
              {player.highlight_url && <a href={player.highlight_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">Highlights ↗</a>}
            </div>
          )}
        </div>
      )}

      {/* Tab Scout */}
      {tab === 'scout' && (
        <div className="flex flex-col gap-4">
          {player.comparable && (
            <div className="card p-4">
              <div className="text-xs text-txt-muted uppercase tracking-widest mb-1">Comparable</div>
              <div className="text-sm text-orange font-medium">{player.comparable}</div>
            </div>
          )}
          {player.ceiling && (
            <div className="card p-4">
              <div className="text-xs text-txt-muted uppercase tracking-widest mb-1">Plafond estimé</div>
              <div className="text-sm text-txt-primary">{player.ceiling}</div>
            </div>
          )}
          {player.strengths && (
            <div className="card p-4 border-teal-border bg-teal-dim/20">
              <div className="text-xs text-teal-light uppercase tracking-widest mb-2">Forces</div>
              <p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.strengths}</p>
            </div>
          )}
          {player.weaknesses && (
            <div className="card p-4 border-red-light/20 bg-red-dim/20">
              <div className="text-xs text-red-light uppercase tracking-widest mb-2">Faiblesses</div>
              <p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.weaknesses}</p>
            </div>
          )}
          {player.observation && (
            <div className="card p-4">
              <div className="text-xs text-txt-muted uppercase tracking-widest mb-2">Observation terrain</div>
              <p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.observation}</p>
            </div>
          )}
          {!player.strengths && !player.weaknesses && !player.observation && (
            <div className="card p-10 text-center text-txt-muted text-sm">
              Aucune note scout — <button onClick={() => setTab('edit')} className="text-orange hover:underline">ajouter</button>
            </div>
          )}
        </div>
      )}

      {/* Tab Rapports */}
      {tab === 'reports' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button onClick={handleAIReport} disabled={aiLoading} className="btn-primary text-xs">
              {aiLoading ? '🤖 Génération...' : '🤖 Générer rapport IA'}
            </button>
          </div>
          {reports.length === 0 ? (
            <div className="card p-10 text-center text-txt-muted text-sm">
              Aucun rapport — génère un rapport IA ou rédige-en un manuellement
            </div>
          ) : reports.map(r => (
            <div key={r.id} className={`card p-4 ${r.source === 'IA' ? 'border-purple-border bg-purple-dim/10' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-widest font-medium ${r.source === 'IA' ? 'text-purple-light' : 'text-teal-light'}`}>
                    {r.source === 'IA' ? '🤖 Rapport IA' : '📋 Rapport manuel'}
                  </span>
                  <span className="text-xs text-txt-muted">{fmtDate(r.report_date)}</span>
                  {r.global_grade && (
                    <span className={`font-bold text-sm ${gradeColor(r.global_grade)}`}>{r.global_grade}/10</span>
                  )}
                </div>
                <button onClick={() => handleDeleteReport(r.id)} className="text-txt-muted hover:text-red-light text-xs transition-colors">
                  Supprimer
                </button>
              </div>
              {r.strengths && (
                <div className="mb-2">
                  <div className="text-[10px] text-teal-light uppercase tracking-widest mb-1">Forces</div>
                  <p className="text-xs text-txt-secondary">{r.strengths}</p>
                </div>
              )}
              {r.weaknesses && (
                <div className="mb-2">
                  <div className="text-[10px] text-red-light uppercase tracking-widest mb-1">Faiblesses</div>
                  <p className="text-xs text-txt-secondary">{r.weaknesses}</p>
                </div>
              )}
              {(r.ai_report || r.observation) && (
                <div className="mt-2 pt-2 border-t border-bg-border">
                  <p className="text-xs text-txt-secondary whitespace-pre-wrap leading-relaxed">
                    {r.ai_report || r.observation}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab Edit */}
      {tab === 'edit' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Prénom', 'first_name'], ['Nom', 'last_name'], ['Nationalité', 'nationality'],
              ['Âge', 'age'], ['Taille (cm)', 'height_cm'], ['Poids (kg)', 'weight_kg'],
              ['Équipe', 'team'], ['Saison', 'season'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input value={form[key] || ''} onChange={e => set(key, e.target.value)} className="input text-xs" />
              </div>
            ))}
            <div>
              <label className="label">Poste</label>
              <select value={form.position || ''} onChange={e => set('position', e.target.value)} className="select text-xs">
                <option value="">—</option>
                {POSTES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ligue</label>
              <select value={form.league || ''} onChange={e => set('league', e.target.value)} className="select text-xs">
                <option value="">—</option>
                {LIGUES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select value={form.status || ''} onChange={e => set('status', e.target.value)} className="select text-xs">
                {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Note (/10)</label>
              <input type="number" min={1} max={10} value={form.scout_grade || 5} onChange={e => set('scout_grade', +e.target.value)} className="input text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              ['Plafond estimé', 'ceiling'], ['Comparable', 'comparable'], ['Photo URL', 'photo_url'],
              ['Highlights URL', 'highlight_url'], ['Basketball-Reference URL', 'bref_url'],
              ['Eurobasket URL', 'eurobasket_url'], ['Barttorvik URL', 'barttorvik_url'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input value={form[key] || ''} onChange={e => set(key, e.target.value)} className="input text-xs" />
              </div>
            ))}
            {[['Forces', 'strengths'], ['Faiblesses', 'weaknesses'], ['Observation terrain', 'observation']].map(([label, key]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <textarea value={form[key] || ''} onChange={e => set(key, e.target.value)} rows={3} className="input text-xs resize-none" />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
              {saving ? 'Sauvegarde...' : '💾 Sauvegarder'}
            </button>
            <button onClick={() => { setTab('stats'); setForm(player) }} className="btn-ghost text-xs">Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
