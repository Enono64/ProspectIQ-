import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getBadgeClass, gradeColor, fmt, fmtDate, LEAGUE_COLOR, STATUTS, LIGUES } from '../lib/utils'
import RadarChart from '../components/RadarChart'
import StatsPanel from '../components/StatsPanel'
import SeasonStats from '../components/SeasonStats'
import TagsManager from '../components/TagsManager'
import ContractTracker from '../components/ContractTracker'
import ImportInstat from '../components/ImportInstat'
import FitAnalysis from '../components/FitAnalysis'
import GPTAnalysis from '../components/GPTAnalysis'

const POSTES = ['PG', 'SG', 'SF', 'PF', 'C', 'PG/SG', 'SG/SF', 'SF/PF', 'PF/C']

function EditStatBox({ label, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const ref = useRef()
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  function commit() {
    const n = val === '' ? null : parseFloat(val)
    if (!isNaN(n) || val === '') onSave(isNaN(n) ? null : n)
    setEditing(false)
  }
  if (editing) return (
    <div className="bg-acc/10 border border-acc/40 rounded-lg p-3 text-center">
      <div className="text-[10px] text-acc uppercase tracking-widest mb-1">{label}</div>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onBlur={commit} onKeyDown={e => { if(e.key==='Enter') commit(); if(e.key==='Escape') setEditing(false) }}
        className="w-full bg-transparent text-xl font-semibold mono text-acc text-center outline-none" />
    </div>
  )
  return (
    <div onClick={() => { setVal(value ?? ''); setEditing(true) }}
      className="bg-bg-card border border-bg-border rounded-lg p-3 text-center cursor-pointer hover:border-acc/30 hover:bg-acc/5 transition-all group">
      <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-1">{label}</div>
      <div className="text-xl font-semibold mono text-txt-primary group-hover:text-acc transition-colors">{value != null ? Number(value).toFixed(1) : '—'}</div>
    </div>
  )
}

function StatBox({ label, value, color = '' }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-3 text-center">
      <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-xl font-semibold font-mono ${color || 'text-txt-primary'}`}>{value ?? '—'}</div>
    </div>
  )
}

function ReportForm({ playerId, onSaved, onCancel }) {
  const [form, setForm] = useState({
    global_grade: 5, strengths: '', weaknesses: '', observation: '',
    recommendation: '', video_url: '', match_context: '', competition: '',
    projected_level: '', projected_role: '',
    score_athletisme: '', score_tir: '', score_creation: '',
    score_defense: '', score_lecture: '', score_mentalite: '',
  })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '' && v !== null))
      await api.createReport(playerId, payload)
      onSaved()
    } catch (e) { alert('Erreur : ' + e.message) }
    setSaving(false)
  }

  const ScoreField = ({ label, k }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="range" min={1} max={10} step={1} value={form[k] || 5}
          onChange={e => set(k, +e.target.value)} className="flex-1" />
        <span className={`font-bold text-sm w-6 text-center ${gradeColor(form[k] || 5)}`}>{form[k] || 5}</span>
      </div>
    </div>
  )

  return (
    <div className="card p-4 border-teal/20 bg-teal/5 flex flex-col gap-4">
      <div className="text-xs text-teal uppercase tracking-widest">📋 Nouveau rapport manuel</div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Match / contexte</label>
          <input value={form.match_context} onChange={e => set('match_context', e.target.value)} className="input text-xs" placeholder="ex: vs Paris, J12" /></div>
        <div><label className="label">Compétition</label>
          <input value={form.competition} onChange={e => set('competition', e.target.value)} className="input text-xs" placeholder="ex: Betclic Élite" /></div>
        <div><label className="label">Lien vidéo</label>
          <input value={form.video_url} onChange={e => set('video_url', e.target.value)} className="input text-xs" placeholder="https://youtube.com/..." /></div>
        <div><label className="label">Note globale</label>
          <div className="flex items-center gap-3">
            <input type="range" min={1} max={10} step={1} value={form.global_grade}
              onChange={e => set('global_grade', +e.target.value)} className="flex-1" />
            <span className={`font-bold text-lg w-8 text-center ${gradeColor(form.global_grade)}`}>{form.global_grade}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ScoreField label="Athlétisme" k="score_athletisme" />
        <ScoreField label="Tir" k="score_tir" />
        <ScoreField label="Création" k="score_creation" />
        <ScoreField label="Défense" k="score_defense" />
        <ScoreField label="Lecture du jeu" k="score_lecture" />
        <ScoreField label="Mentalité" k="score_mentalite" />
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div><label className="label">Forces</label>
          <textarea value={form.strengths} onChange={e => set('strengths', e.target.value)} rows={2} className="input text-xs resize-none" /></div>
        <div><label className="label">Faiblesses</label>
          <textarea value={form.weaknesses} onChange={e => set('weaknesses', e.target.value)} rows={2} className="input text-xs resize-none" /></div>
        <div><label className="label">Observation terrain</label>
          <textarea value={form.observation} onChange={e => set('observation', e.target.value)} rows={3} className="input text-xs resize-none" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Niveau projeté</label>
          <input value={form.projected_level} onChange={e => set('projected_level', e.target.value)} className="input text-xs" /></div>
        <div><label className="label">Rôle projeté</label>
          <input value={form.projected_role} onChange={e => set('projected_role', e.target.value)} className="input text-xs" /></div>
        <div className="col-span-2"><label className="label">Recommandation finale</label>
          <input value={form.recommendation} onChange={e => set('recommendation', e.target.value)} className="input text-xs" placeholder="⭐ TOP PROSPECT / 🟢 PRIORITAIRE..." /></div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">{saving ? 'Sauvegarde...' : '💾 Sauvegarder'}</button>
        <button onClick={onCancel} className="btn-ghost text-xs">Annuler</button>
      </div>
    </div>
  )
}

async function exportPDF(player) {
  try {
    const { supabase } = await import('../lib/api')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''
    const resp = await fetch(
      import.meta.env.VITE_API_URL + '/players/' + player.id + '/pdf',
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (!resp.ok) throw new Error('Erreur génération PDF')
    const blob = await resp.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'rapport_' + player.first_name + '_' + player.last_name + '.pdf'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) { alert('❌ ' + e.message) }
}

export default function PlayerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [aiLoading, setAiLoading]   = useState(false)
  const [tab, setTab]               = useState('stats')
  const [saving, setSaving]         = useState(false)
  const [showReportForm, setShowReportForm] = useState(false)
  const [showInstat, setShowInstat] = useState(false)
  const [form, setForm]             = useState({})

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
    setTimeout(load, 4000)
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
    setTab('stats')
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce joueur ?')) return
    await api.deletePlayer(id)
    navigate('/players')
  }

  async function handleDeleteReport(rid) {
    if (!confirm('Supprimer ce rapport ?')) return
    await api.deleteReport(rid)
    await load()
  }

  async function handleBarttorvik() {
    try {
      const res = await api.syncBarttorvik(id)
      if (res.ok) { await load(); alert('✅ Barttorvik sync réussi') }
      else alert('❌ ' + res.error)
    } catch (e) { alert('❌ ' + e.message) }
  }

  async function handleInstatImport(stats, file) {
    try {
      await api.updatePlayer(id, stats)
      await load()
      setShowInstat(false)
      alert('✅ Stats InStat importées !')
    } catch (e) { alert('❌ ' + e.message) }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  if (loading) return <div className="p-10 text-txt-muted text-sm animate-pulse text-center">Chargement...</div>
  if (!player)  return <div className="p-10 text-red text-sm text-center">Joueur introuvable</div>

  const reports = player.reports || []
  const pos = player.position || ''

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header fixe */}
      <div className="flex-shrink-0 bg-bg-surface border-b border-bg-border px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate(-1)} className="btn-ghost text-xs mt-1">← Retour</button>

          <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-card border border-bg-border flex-shrink-0">
            {player.photo_url
              ? <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-txt-muted font-bold text-sm">
                  {player.first_name?.[0]}{player.last_name?.[0]}
                </div>
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-bold text-txt-primary">{player.first_name} {player.last_name}</h1>
              {player.position && <span className="px-1.5 py-0.5 rounded bg-purple/10 text-purple text-[10px] font-medium">{player.position}</span>}
              <span className={getBadgeClass(player.status)}>{player.status}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {player.team   && <span className="text-xs text-txt-secondary">{player.team}</span>}
              {player.league && <span className="text-xs font-medium" style={{ color: LEAGUE_COLOR[player.league] || '#888' }}>{player.league}</span>}
              {player.age    && <span className="text-xs text-txt-muted">{player.age} ans</span>}
              {player.height_cm && <span className="text-xs text-txt-muted">{player.height_cm}cm</span>}
              <span className={`text-sm font-bold ${gradeColor(player.scout_grade)}`}>{player.scout_grade}/10</span>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap justify-end">
            <button onClick={() => exportPDF(player)} className="btn-ghost text-xs py-1">📄 PDF</button>
            <button onClick={() => setShowInstat(!showInstat)} className="btn-ghost text-xs py-1">📊 InStat</button>
            <button onClick={handleSync} disabled={syncing} className="btn-ghost text-xs py-1">{syncing ? '🔄...' : '🔄 Sync'}</button>
            <button onClick={handleAIReport} disabled={aiLoading} className="btn-primary text-xs py-1">{aiLoading ? '🤖...' : '🤖 Rapport IA'}</button>
            <button onClick={handleDelete} className="btn-danger text-xs py-1">Supprimer</button>
          </div>
        </div>

        {/* InStat panel */}
        {showInstat && (
          <div className="mt-3">
            <ImportInstat
              playerId={id}
              onImport={handleInstatImport}
              onClose={() => setShowInstat(false)}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 mt-3 -mb-3 overflow-x-auto">
          {[
            ['stats','Statistiques'],['fit','🎯 Fit'],['gpt','🧠 GPT'],['scout','Scout'],
            ['reports',`Rapports (${reports.length})`],['seasons','Saisons'],
            ['contract','Contrat'],['tags','Tags'],['edit','Modifier'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                tab === key ? 'text-acc border-acc' : 'text-txt-muted border-transparent hover:text-txt-secondary'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ── Tab Stats ── */}
        {tab === 'stats' && (
          <StatsPanel player={player} onUpdate={async (updates) => {
            await api.updatePlayer(id, updates)
            await load()
          }} />
        )}

        {/* ── Tab Fit Analysis ── */}
        {tab === 'fit' && <FitAnalysis player={player} />}

        {/* ── Tab GPT Analysis ── */}
        {tab === 'gpt' && <GPTAnalysis player={player} />}

        {/* ── Tab Scout ── */}
        {tab === 'scout' && (
          <div className="flex flex-col gap-4">
            {player.comparable && (
              <div className="card p-4">
                <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-1">Comparable</div>
                <div className="text-sm text-acc font-medium">{player.comparable}</div>
              </div>
            )}
            {player.ceiling && (
              <div className="card p-4">
                <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-1">Plafond estimé</div>
                <div className="text-sm text-txt-primary">{player.ceiling}</div>
              </div>
            )}
            {player.strengths && (
              <div className="card p-4 border-teal/20 bg-teal/5">
                <div className="text-[10px] text-teal uppercase tracking-widest mb-2">Forces</div>
                <p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.strengths}</p>
              </div>
            )}
            {player.weaknesses && (
              <div className="card p-4 border-red/20 bg-red/5">
                <div className="text-[10px] text-red uppercase tracking-widest mb-2">Faiblesses</div>
                <p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.weaknesses}</p>
              </div>
            )}
            {player.observation && (
              <div className="card p-4">
                <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-2">Observation terrain</div>
                <p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.observation}</p>
              </div>
            )}
            {!player.strengths && !player.weaknesses && !player.observation && (
              <div className="card p-10 text-center text-txt-muted text-sm">Aucune note — <button onClick={() => setTab('edit')} className="text-acc hover:underline">ajouter</button></div>
            )}
          </div>
        )}

        {/* ── Tab Rapports ── */}
        {tab === 'reports' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReportForm(!showReportForm)} className="btn-ghost text-xs">
                {showReportForm ? '✕ Annuler' : '📋 Rapport manuel'}
              </button>
              <button onClick={handleAIReport} disabled={aiLoading} className="btn-primary text-xs">
                {aiLoading ? '🤖 Génération...' : '🤖 Rapport IA'}
              </button>
            </div>

            {showReportForm && (
              <ReportForm
                playerId={id}
                onSaved={() => { setShowReportForm(false); load() }}
                onCancel={() => setShowReportForm(false)}
              />
            )}

            {reports.length === 0 && !showReportForm ? (
              <div className="card p-10 text-center text-txt-muted text-sm">Aucun rapport — génère un rapport IA ou rédige-en un manuellement</div>
            ) : reports.map(r => (
              <div key={r.id} className={`card p-4 ${r.source === 'IA' ? 'border-purple/20 bg-purple/5' : 'border-teal/20 bg-teal/5'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase tracking-widest font-medium ${r.source === 'IA' ? 'text-purple' : 'text-teal'}`}>
                      {r.source === 'IA' ? '🤖 Rapport IA' : '📋 Rapport manuel'}
                    </span>
                    <span className="text-xs text-txt-muted">{fmtDate(r.report_date)}</span>
                    {r.global_grade && <span className={`font-bold text-sm ${gradeColor(r.global_grade)}`}>{r.global_grade}/10</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => exportPDF(player)} className="text-txt-muted hover:text-acc text-xs">📄 PDF</button>
                    <button onClick={() => handleDeleteReport(r.id)} className="text-txt-muted hover:text-red text-xs">Supprimer</button>
                  </div>
                </div>
                {r.strengths && <div className="mb-2"><div className="text-[10px] text-teal uppercase tracking-widest mb-1">Forces</div><p className="text-xs text-txt-secondary">{r.strengths}</p></div>}
                {r.weaknesses && <div className="mb-2"><div className="text-[10px] text-red uppercase tracking-widest mb-1">Faiblesses</div><p className="text-xs text-txt-secondary">{r.weaknesses}</p></div>}
                {(r.ai_report || r.observation) && (
                  <div className="mt-2 pt-2 border-t border-bg-border">
                    <p className="text-xs text-txt-secondary whitespace-pre-wrap leading-relaxed">{r.ai_report || r.observation}</p>
                  </div>
                )}
                {r.recommendation && <div className="mt-2 pt-2 border-t border-bg-border"><span className="text-xs font-medium text-acc">{r.recommendation}</span></div>}
                {r.video_url && <a href={r.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple hover:underline mt-2 block">🎬 Highlights ↗</a>}
              </div>
            ))}
          </div>
        )}

        {/* ── Tab Saisons ── */}
        {tab === 'seasons' && <SeasonStats playerId={id} />}

        {/* ── Tab Contrat ── */}
        {tab === 'contract' && <ContractTracker player={player} onUpdate={p => { setPlayer(p); setForm(p) }} />}

        {/* ── Tab Tags ── */}
        {tab === 'tags' && <TagsManager player={player} onUpdate={p => { setPlayer(p); setForm(p) }} />}

        {/* ── Tab Modifier ── */}
        {tab === 'edit' && (
          <div className="flex flex-col gap-4">
            <div className="card p-4">
              <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Identité</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[['Prénom','first_name'],['Nom','last_name'],['Nationalité','nationality'],['Âge','age']].map(([label, key]) => (
                  <div key={key}><label className="label">{label}</label><input value={form[key] || ''} onChange={e => set(key, e.target.value)} className="input text-xs" /></div>
                ))}
                {[['Taille (cm)','height_cm'],['Poids (kg)','weight_kg']].map(([label, key]) => (
                  <div key={key}><label className="label">{label}</label><input type="number" value={form[key] || ''} onChange={e => set(key, e.target.value)} className="input text-xs" /></div>
                ))}
                <div>
                  <label className="label">Poste</label>
                  <input value={form.position || ''} onChange={e => set('position', e.target.value)} className="input text-xs" placeholder="PG, SG, PG/SG..." list="postes-list" />
                  <datalist id="postes-list">{POSTES.map(p => <option key={p} value={p} />)}</datalist>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Équipe & statut</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className="label">Équipe</label><input value={form.team || ''} onChange={e => set('team', e.target.value)} className="input text-xs" /></div>
                <div><label className="label">Ligue</label>
                  <select value={form.league || ''} onChange={e => set('league', e.target.value)} className="select text-xs">
                    <option value="">—</option>
                    {LIGUES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div><label className="label">Statut</label>
                  <select value={form.status || ''} onChange={e => set('status', e.target.value)} className="select text-xs">
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div><label className="label">Note (/10)</label><input type="number" min={1} max={10} value={form.scout_grade || 5} onChange={e => set('scout_grade', +e.target.value)} className="input text-xs" /></div>
                <div><label className="label">Plafond</label><input value={form.ceiling || ''} onChange={e => set('ceiling', e.target.value)} className="input text-xs" /></div>
                <div><label className="label">Comparable</label><input value={form.comparable || ''} onChange={e => set('comparable', e.target.value)} className="input text-xs" /></div>
                <div><label className="label">Saison</label><input value={form.season || '2024-25'} onChange={e => set('season', e.target.value)} className="input text-xs" /></div>
                <div><label className="label">BPM</label><input type="number" step="0.1" value={form.bpm ?? ''} onChange={e => set('bpm', e.target.value ? parseFloat(e.target.value) : null)} className="input text-xs" /></div>
              </div>
            </div>

            <div className="card p-4">
              <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Notes scout</div>
              <div className="grid grid-cols-1 gap-3">
                {[['Forces','strengths'],['Faiblesses','weaknesses'],['Observation terrain','observation']].map(([label, key]) => (
                  <div key={key}><label className="label">{label}</label>
                    <textarea value={form[key] || ''} onChange={e => set(key, e.target.value)} rows={3} className="input text-xs resize-none" /></div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Liens & médias</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[['Photo URL','photo_url'],['Highlights URL','highlight_url'],['Basketball-Reference','bref_url'],['Eurobasket URL','eurobasket_url'],['Barttorvik URL','barttorvik_url']].map(([label, key]) => (
                  <div key={key}><label className="label">{label}</label><input value={form[key] || ''} onChange={e => set(key, e.target.value)} className="input text-xs" /></div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">{saving ? 'Sauvegarde...' : '💾 Sauvegarder'}</button>
              <button onClick={() => { setTab('stats'); setForm(player) }} className="btn-ghost text-xs">Annuler</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
