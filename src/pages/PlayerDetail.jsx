import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getBadgeClass, gradeColor, fmt, fmtDate, LEAGUE_COLOR, STATUTS, LIGUES } from '../lib/utils'
import RadarChart from '../components/RadarChart'
import StatsPanel from '../components/StatsPanel'
import SeasonStats from '../components/SeasonStats'
import ImportInstat from '../components/ImportInstat'

const POSTES = ['PG', 'SG', 'SF', 'PF', 'C', 'PG/SG', 'SG/SF', 'SF/PF', 'PF/C']

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
    score_athletisme: 5, score_tir: 5, score_creation: 5,
    score_defense: 5, score_lecture: 5, score_mentalite: 5,
  })
  const [saving, setSaving] = useState(false)
  async function handleBarttorvik() {
    setBartLoading(true)
    try {
      const res = await api.syncBarttorvik(id)
      if (res.ok) { await load(); alert(\`✅ Barttorvik sync réussi — \${Object.keys(res.stats).length} stats mises à jour\`) }
      else alert('Erreur Barttorvik : ' + res.error)
    } catch (e) { alert('Erreur : ' + e.message) }
    setBartLoading(false)
  }

  async function handleKenpom() {
    if (!kenpomTeam) return alert('Entre le nom de l'équipe KenPom')
    setKenpomLoading(true)
    try {
      const res = await api.syncKenpom(id, kenpomTeam)
      if (res.ok) { await load(); setShowKenpomForm(false); alert('✅ KenPom sync réussi') }
      else alert('Erreur KenPom : ' + res.error)
    } catch (e) { alert('Erreur : ' + e.message) }
    setKenpomLoading(false)
  }

  async function handleInstatImport(stats) {
    try {
      await api.updatePlayer(id, stats)
      await load()
    } catch (e) {
      alert('Erreur import InStat : ' + e.message)
    }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    try {
      await api.createReport(playerId, form)
      onSaved()
    } catch (e) { alert('Erreur : ' + e.message) }
    setSaving(false)
  }

  return (
    <div className="card p-4 border-teal-border bg-teal-dim/10 flex flex-col gap-4">
      <div className="text-xs text-teal-light uppercase tracking-widest">📋 Nouveau rapport manuel</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Match / contexte</label>
          <input value={form.match_context} onChange={e => set('match_context', e.target.value)} className="input text-xs" placeholder="vs Paris, J12" />
        </div>
        <div>
          <label className="label">Compétition</label>
          <input value={form.competition} onChange={e => set('competition', e.target.value)} className="input text-xs" placeholder="Betclic Élite" />
        </div>
        <div>
          <label className="label">Vidéo / highlights</label>
          <input value={form.video_url} onChange={e => set('video_url', e.target.value)} className="input text-xs" placeholder="https://youtube.com/..." />
        </div>
        <div>
          <label className="label">Note globale — {form.global_grade}/10</label>
          <input type="range" min={1} max={10} step={1} value={form.global_grade}
            onChange={e => set('global_grade', +e.target.value)} className="w-full mt-2" />
        </div>
      </div>

      <div>
        <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Scores détaillés</div>
        <div className="grid grid-cols-2 gap-3">
          {[['Athlétisme','score_athletisme'],['Tir','score_tir'],['Création','score_creation'],['Défense','score_defense'],['Lecture du jeu','score_lecture'],['Mentalité','score_mentalite']].map(([label, k]) => (
            <div key={k}>
              <label className="label">{label} — <span className={gradeColor(form[k])}>{form[k]}</span>/10</label>
              <input type="range" min={1} max={10} step={1} value={form[k]}
                onChange={e => set(k, +e.target.value)} className="w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="label">Forces</label>
          <textarea value={form.strengths} onChange={e => set('strengths', e.target.value)} rows={2} className="input text-xs resize-none" placeholder="Points forts observés..." />
        </div>
        <div>
          <label className="label">Faiblesses</label>
          <textarea value={form.weaknesses} onChange={e => set('weaknesses', e.target.value)} rows={2} className="input text-xs resize-none" placeholder="Points à améliorer..." />
        </div>
        <div>
          <label className="label">Observation terrain</label>
          <textarea value={form.observation} onChange={e => set('observation', e.target.value)} rows={3} className="input text-xs resize-none" placeholder="Tes notes personnelles..." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Niveau projeté</label>
          <input value={form.projected_level} onChange={e => set('projected_level', e.target.value)} className="input text-xs" placeholder="EuroLeague starter" />
        </div>
        <div>
          <label className="label">Rôle projeté</label>
          <input value={form.projected_role} onChange={e => set('projected_role', e.target.value)} className="input text-xs" placeholder="Titulaire / Rotation" />
        </div>
        <div className="col-span-2">
          <label className="label">Verdict final</label>
          <input value={form.recommendation} onChange={e => set('recommendation', e.target.value)} className="input text-xs" placeholder="⭐ TOP PROSPECT / 🟢 PRIORITAIRE / 🟡 À SURVEILLER..." />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
          {saving ? 'Sauvegarde...' : '💾 Sauvegarder'}
        </button>
        <button onClick={onCancel} className="btn-ghost text-xs">Annuler</button>
      </div>
    </div>
  )
}

async function exportPDF(player, reports) {
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  let y = 20

  // Header
  doc.setFillColor(13, 13, 20)
  doc.rect(0, 0, W, 42, 'F')
  doc.setFillColor(232, 96, 28)
  doc.rect(0, 0, 4, 42, 'F')

  doc.setTextColor(232, 96, 28)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('PROSPECTIQ', 12, 11)

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text(`${player.first_name} ${player.last_name}`, 12, 23)
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 122)
  const meta = [player.position, player.team, player.league, player.nationality, player.age ? `${player.age} ans` : null, player.height_cm ? `${player.height_cm} cm` : null].filter(Boolean).join('  ·  ')
  doc.text(meta, 12, 32)

  // Note
  doc.setFillColor(232, 96, 28)
  doc.roundedRect(W - 32, 8, 24, 24, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`${player.scout_grade || 5}`, W - 20, 23, { align: 'center' })
  doc.setFontSize(7)
  doc.text('/10', W - 20, 29, { align: 'center' })

  y = 52

  // Stats
  doc.setFillColor(20, 20, 30)
  doc.rect(10, y, W - 20, 9, 'F')
  doc.setTextColor(232, 96, 28)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('STATISTIQUES 2024-25', 14, y + 6)
  y += 13

  const stats = [
    ['PTS', player.pts], ['REB', player.reb], ['AST', player.ast],
    ['STL', player.stl], ['BLK', player.blk], ['TOV', player.tov],
    ['FG%', player.fg_pct], ['3P%', player.fg3_pct], ['FT%', player.ft_pct],
    ['TS%', player.ts_pct], ['USG%', player.usg_pct], ['BPM', player.bpm],
  ]
  const colW = (W - 20) / 6
  stats.forEach(([label, val], i) => {
    const col = i % 6
    const row = Math.floor(i / 6)
    const x = 10 + col * colW
    const rowY = y + row * 16
    doc.setFillColor(15, 15, 25)
    doc.rect(x + 0.5, rowY, colW - 1, 14, 'F')
    doc.setTextColor(90, 90, 122)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.text(label, x + colW / 2, rowY + 4.5, { align: 'center' })
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(val != null ? String(Number(val).toFixed(1)) : '—', x + colW / 2, rowY + 11, { align: 'center' })
  })
  y += 36

  // Profil scout
  if (player.strengths || player.weaknesses || player.ceiling || player.comparable) {
    y += 4
    doc.setFillColor(20, 20, 30)
    doc.rect(10, y, W - 20, 9, 'F')
    doc.setTextColor(232, 96, 28)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('PROFIL SCOUT', 14, y + 6)
    y += 13

    if (player.ceiling) {
      doc.setTextColor(232, 96, 28)
      doc.setFontSize(8)
      doc.text(`Plafond : ${player.ceiling}`, 14, y)
      y += 6
    }
    if (player.comparable) {
      doc.setTextColor(90, 90, 122)
      doc.setFontSize(8)
      doc.text(`Comparable : ${player.comparable}`, 14, y)
      y += 6
    }
    if (player.strengths) {
      doc.setTextColor(93, 202, 165)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text('Forces', 14, y)
      y += 5
      doc.setTextColor(184, 184, 208)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(player.strengths, W - 28)
      doc.text(lines, 14, y)
      y += lines.length * 4.5 + 3
    }
    if (player.weaknesses) {
      doc.setTextColor(240, 149, 149)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text('Faiblesses', 14, y)
      y += 5
      doc.setTextColor(184, 184, 208)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(player.weaknesses, W - 28)
      doc.text(lines, 14, y)
      y += lines.length * 4.5 + 3
    }
  }

  // Dernier rapport
  const r = reports?.[0]
  if (r) {
    y += 4
    doc.setFillColor(20, 20, 30)
    doc.rect(10, y, W - 20, 9, 'F')
    doc.setTextColor(232, 96, 28)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(`RAPPORT ${r.source === 'IA' ? 'IA' : 'MANUEL'} — ${fmtDate(r.report_date)}`, 14, y + 6)
    y += 13

    const obs = r.ai_report || r.observation
    if (obs) {
      doc.setTextColor(184, 184, 208)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(obs.substring(0, 1200), W - 28)
      doc.text(lines, 14, y)
      y += lines.length * 4.5
    }
    if (r.recommendation) {
      y += 4
      doc.setTextColor(232, 96, 28)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(r.recommendation, 14, y)
    }
  }

  // Footer
  doc.setFillColor(13, 13, 20)
  doc.rect(0, 283, W, 14, 'F')
  doc.setFillColor(232, 96, 28)
  doc.rect(0, 283, 4, 14, 'F')
  doc.setTextColor(90, 90, 122)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('ProspectIQ — Rapport confidentiel', 12, 291)
  doc.text(new Date().toLocaleDateString('fr-FR'), W - 12, 291, { align: 'right' })

  doc.save(`ProspectIQ_${player.first_name}_${player.last_name}.pdf`)
}

export default function PlayerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [tab, setTab]             = useState('stats')
  const [saving, setSaving]       = useState(false)
  const [showReportForm, setShowReportForm] = useState(false)
  const [showInstat, setShowInstat]         = useState(false)
  const [bartLoading, setBartLoading]       = useState(false)
  const [kenpomLoading, setKenpomLoading]   = useState(false)
  const [showKenpomForm, setShowKenpomForm] = useState(false)
  const [kenpomTeam, setKenpomTeam]         = useState('')
  const [form, setForm]           = useState({})

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
    setBartLoading(true)
    try {
      const res = await api.syncBarttorvik(id)
      if (res.ok) { await load(); alert(\`✅ Barttorvik sync réussi — \${Object.keys(res.stats).length} stats mises à jour\`) }
      else alert('Erreur Barttorvik : ' + res.error)
    } catch (e) { alert('Erreur : ' + e.message) }
    setBartLoading(false)
  }

  async function handleKenpom() {
    if (!kenpomTeam) return alert('Entre le nom de l'équipe KenPom')
    setKenpomLoading(true)
    try {
      const res = await api.syncKenpom(id, kenpomTeam)
      if (res.ok) { await load(); setShowKenpomForm(false); alert('✅ KenPom sync réussi') }
      else alert('Erreur KenPom : ' + res.error)
    } catch (e) { alert('Erreur : ' + e.message) }
    setKenpomLoading(false)
  }

  async function handleInstatImport(stats) {
    try {
      await api.updatePlayer(id, stats)
      await load()
    } catch (e) {
      alert('Erreur import InStat : ' + e.message)
    }
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
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-bg-card border border-bg-border flex-shrink-0">
          {player.photo_url
            ? <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-txt-muted font-bold text-lg">
                {player.first_name?.[0]}{player.last_name?.[0]}
              </div>
          }
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-txt-primary">{player.first_name} {player.last_name}</h1>
            {player.position && <span className="px-2 py-0.5 rounded bg-purple-dim text-purple-light text-xs font-medium">{player.position}</span>}
            <span className={getBadgeClass(player.status)}>{player.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {player.team      && <span className="text-sm text-txt-secondary">{player.team}</span>}
            {player.league    && <span className="text-sm font-medium" style={{ color: LEAGUE_COLOR[player.league] || '#888' }}>{player.league}</span>}
            {player.age       && <span className="text-xs text-txt-muted">{player.age} ans</span>}
            {player.height_cm && <span className="text-xs text-txt-muted">{player.height_cm} cm</span>}
            {player.nationality && <span className="text-xs text-txt-muted">{player.nationality}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-txt-muted">Note :</span>
            <span className={`text-base font-bold ${gradeColor(player.scout_grade)}`}>{player.scout_grade}/10</span>
            {player.ceiling && <span className="text-xs text-orange ml-2">Plafond : {player.ceiling}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={() => exportPDF(player, reports)} className="btn-ghost text-xs">📄 PDF</button>
          <button onClick={() => setShowInstat(!showInstat)} className="btn-ghost text-xs border-blue-border text-blue-light">📊 InStat</button>
          {player.league?.includes('NCAA') || player.barttorvik_url ? (
            <button onClick={handleBarttorvik} disabled={bartLoading} className="btn-ghost text-xs" style={{borderColor:'#ffaa0044',color:'#ffaa00'}}>
              {bartLoading ? '⟳ Bart...' : '📈 Barttorvik'}
            </button>
          ) : null}
          <button onClick={() => setShowKenpomForm(!showKenpomForm)} className="btn-ghost text-xs" style={{borderColor:'#4488ff44',color:'#4488ff'}}>
            🏫 KenPom
          </button>
          <button onClick={handleSync} disabled={syncing} className="btn-ghost text-xs">{syncing ? '⟳ ...' : '⟳ Sync'}</button>
          <button onClick={handleAIReport} disabled={aiLoading} className="btn-primary text-xs">{aiLoading ? '🤖 ...' : '🤖 Rapport IA'}</button>
          <button onClick={handleDelete} className="btn-danger text-xs">Supprimer</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bg-border">
        {[['stats','Statistiques'],['scout','Scout'],['reports',`Rapports (${reports.length})`],['edit','Modifier']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${tab === key ? 'text-orange border-orange' : 'text-txt-muted border-transparent hover:text-txt-secondary'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Stats */}
      {tab === 'stats' && (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-txt-muted uppercase tracking-widest">
            Stats — {player.season || '2024-25'}
            {player.last_synced_at && <span className="ml-2 normal-case">· Sync {fmtDate(player.last_synced_at)}</span>}
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
            {[['PTS',player.pts],['REB',player.reb],['AST',player.ast],['STL',player.stl],['BLK',player.blk],['TOV',player.tov],['FG%',player.fg_pct],['3P%',player.fg3_pct],['FT%',player.ft_pct]].map(([l,v]) => <StatBox key={l} label={l} value={fmt(v)} />)}
          </div>
          <div className="text-xs text-txt-muted uppercase tracking-widest mt-2">Stats avancées</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            <StatBox label="TS%"    value={fmt(player.ts_pct)}  color="text-teal-light" />
            <StatBox label="eFG%"   value={fmt(player.efg_pct)} color="text-teal-light" />
            <StatBox label="USG%"   value={fmt(player.usg_pct)} />
            <StatBox label="PER"    value={fmt(player.per)} />
            <StatBox label="BPM"    value={player.bpm != null ? (player.bpm >= 0 ? '+' : '') + fmt(player.bpm) : '—'} color={player.bpm >= 0 ? 'text-teal-light' : 'text-red-light'} />
            <StatBox label="VORP"   value={fmt(player.vorp)} color="text-purple-light" />
            <StatBox label="ORTG"   value={fmt(player.ortg, 0)} />
            <StatBox label="DRTG"   value={fmt(player.drtg, 0)} />
            <StatBox label="Net"    value={player.net_rtg != null ? (player.net_rtg >= 0 ? '+' : '') + fmt(player.net_rtg) : '—'} color={player.net_rtg >= 0 ? 'text-teal-light' : 'text-red-light'} />
            <StatBox label="AST/TO" value={fmt(player.ast_to, 2)} />
          </div>
          {showKenpomForm && (
            <div className="card p-4 flex flex-col gap-3" style={{borderColor:'#4488ff30',background:'#4488ff08'}}>
              <div className="text-xs uppercase tracking-widest" style={{color:'#4488ff'}}>🏫 Sync KenPom</div>
              <div className="flex gap-2">
                <input
                  value={kenpomTeam}
                  onChange={e => setKenpomTeam(e.target.value)}
                  className="input text-xs flex-1"
                  placeholder="Nom équipe KenPom ex: George Washington"
                />
                <button onClick={handleKenpom} disabled={kenpomLoading} className="btn-primary text-xs">
                  {kenpomLoading ? '⟳ ...' : 'Sync'}
                </button>
                <button onClick={() => setShowKenpomForm(false)} className="btn-ghost text-xs">✕</button>
              </div>
              <p className="text-[10px] text-txt-muted">Récupère AdjOE, AdjDE, Tempo, Luck de l'équipe du joueur sur kenpom.com</p>
              {(player.kenpom_adjoe || player.kenpom_adjde) && (
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {[['AdjOE', player.kenpom_adjoe],['AdjDE', player.kenpom_adjde],['Tempo', player.kenpom_tempo],['Luck', player.kenpom_luck]].map(([l,v]) => v != null && (
                    <div key={l} className="bg-bg-card border border-bg-border rounded-lg p-2 text-center">
                      <div className="text-[9px] text-txt-muted uppercase">{l}</div>
                      <div className="mono text-sm font-semibold text-txt-primary">{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showInstat && (
            <ImportInstat
              onImport={handleInstatImport}
              onClose={() => setShowInstat(false)}
            />
          )}

          <StatsPanel player={player} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RadarChart player={player} />
            {(player.bref_url || player.eurobasket_url || player.highlight_url) && (
              <div className="card p-4">
                <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Liens</div>
                <div className="flex flex-col gap-2">
                  {player.bref_url && <a href={player.bref_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">Basketball-Reference ↗</a>}
                  {player.eurobasket_url && <a href={player.eurobasket_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">Eurobasket ↗</a>}
                  {player.highlight_url && <a href={player.highlight_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">Highlights ↗</a>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scout */}
      {tab === 'scout' && (
        <div className="flex flex-col gap-4">
          {player.comparable && <div className="card p-4"><div className="text-xs text-txt-muted uppercase tracking-widest mb-1">Comparable</div><div className="text-sm text-orange font-medium">{player.comparable}</div></div>}
          {player.ceiling    && <div className="card p-4"><div className="text-xs text-txt-muted uppercase tracking-widest mb-1">Plafond</div><div className="text-sm text-txt-primary">{player.ceiling}</div></div>}
          {player.strengths  && <div className="card p-4 border-teal-border bg-teal-dim/20"><div className="text-xs text-teal-light uppercase tracking-widest mb-2">Forces</div><p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.strengths}</p></div>}
          {player.weaknesses && <div className="card p-4 border-red-light/20 bg-red-dim/20"><div className="text-xs text-red-light uppercase tracking-widest mb-2">Faiblesses</div><p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.weaknesses}</p></div>}
          {player.observation && <div className="card p-4"><div className="text-xs text-txt-muted uppercase tracking-widest mb-2">Observation terrain</div><p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.observation}</p></div>}
          {!player.strengths && !player.weaknesses && !player.observation && (
            <div className="card p-10 text-center text-txt-muted text-sm">Aucune note — <button onClick={() => setTab('edit')} className="text-orange hover:underline">ajouter</button></div>
          )}
        </div>
      )}

      {/* Rapports */}
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
            <ReportForm playerId={id} onSaved={() => { setShowReportForm(false); load() }} onCancel={() => setShowReportForm(false)} />
          )}

          {reports.length === 0 && !showReportForm && (
            <div className="card p-10 text-center text-txt-muted text-sm">Aucun rapport</div>
          )}

          {reports.map(r => (
            <div key={r.id} className={`card p-4 ${r.source === 'IA' ? 'border-purple-border bg-purple-dim/10' : 'border-teal-border bg-teal-dim/10'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] uppercase tracking-widest font-medium ${r.source === 'IA' ? 'text-purple-light' : 'text-teal-light'}`}>
                    {r.source === 'IA' ? '🤖 IA' : '📋 Manuel'}
                  </span>
                  <span className="text-xs text-txt-muted">{fmtDate(r.report_date)}</span>
                  {r.global_grade && <span className={`font-bold text-sm ${gradeColor(r.global_grade)}`}>{r.global_grade}/10</span>}
                  {r.match_context && <span className="text-xs text-txt-muted">· {r.match_context}</span>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => exportPDF(player, [r])} className="text-txt-muted hover:text-orange text-xs">📄 PDF</button>
                  <button onClick={() => handleDeleteReport(r.id)} className="text-txt-muted hover:text-red-light text-xs">Supprimer</button>
                </div>
              </div>

              {(r.score_athletisme || r.score_tir) && (
                <div className="grid grid-cols-6 gap-1 mb-3">
                  {[['Athlét.',r.score_athletisme],['Tir',r.score_tir],['Création',r.score_creation],['Défense',r.score_defense],['Lecture',r.score_lecture],['Mental',r.score_mentalite]].filter(([,v])=>v).map(([label,val])=>(
                    <div key={label} className="bg-bg-card rounded p-2 text-center">
                      <div className="text-[9px] text-txt-muted">{label}</div>
                      <div className={`text-sm font-bold font-mono ${gradeColor(val)}`}>{val}</div>
                    </div>
                  ))}
                </div>
              )}

              {r.strengths   && <div className="mb-2"><div className="text-[10px] text-teal-light uppercase tracking-widest mb-1">Forces</div><p className="text-xs text-txt-secondary">{r.strengths}</p></div>}
              {r.weaknesses  && <div className="mb-2"><div className="text-[10px] text-red-light uppercase tracking-widest mb-1">Faiblesses</div><p className="text-xs text-txt-secondary">{r.weaknesses}</p></div>}
              {r.projected_level && <div className="mb-2"><div className="text-[10px] text-orange uppercase tracking-widest mb-1">Projection</div><p className="text-xs text-txt-secondary">{r.projected_level}{r.projected_role ? ` — ${r.projected_role}` : ''}</p></div>}
              {(r.ai_report || r.observation) && <div className="mt-2 pt-2 border-t border-bg-border"><p className="text-xs text-txt-secondary whitespace-pre-wrap leading-relaxed">{r.ai_report || r.observation}</p></div>}
              {r.video_url   && <div className="mt-2"><a href={r.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-light hover:underline">🎬 Highlights ↗</a></div>}
              {r.recommendation && <div className="mt-2 pt-2 border-t border-bg-border"><span className="text-xs font-medium text-orange">{r.recommendation}</span></div>}
            </div>
          ))}
        </div>
      )}

      {/* Saisons */}
      {tab === 'seasons' && (
        <div className="card p-4">
          <SeasonStats playerId={id} />
        </div>
      )}

      {/* Modifier */}
      {tab === 'edit' && (
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Identité</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Prénom','first_name'],['Nom','last_name'],['Nationalité','nationality'],['Âge','age'],['Taille (cm)','height_cm'],['Poids (kg)','weight_kg'],['Numéro','number']].map(([label,key])=>(
                <div key={key}>
                  <label className="label">{label}</label>
                  <input value={form[key]||''} onChange={e=>set(key,e.target.value)} className="input text-xs" />
                </div>
              ))}
              <div>
                <label className="label">Poste (libre)</label>
                <input value={form.position||''} onChange={e=>set('position',e.target.value)} className="input text-xs" placeholder="PG, SG, PG/SG..." list="postes-list" />
                <datalist id="postes-list">{POSTES.map(p=><option key={p} value={p}/>)}</datalist>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Équipe & statut</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">Équipe (libre)</label>
                <input value={form.team||''} onChange={e=>set('team',e.target.value)} className="input text-xs" placeholder="AS Monaco, ASVEL..." />
              </div>
              <div>
                <label className="label">Ligue</label>
                <select value={form.league||''} onChange={e=>set('league',e.target.value)} className="select text-xs">
                  <option value="">—</option>
                  {LIGUES.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Statut</label>
                <select value={form.status||''} onChange={e=>set('status',e.target.value)} className="select text-xs">
                  {STATUTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Note (/10)</label>
                <input type="number" min={1} max={10} value={form.scout_grade||5} onChange={e=>set('scout_grade',+e.target.value)} className="input text-xs" />
              </div>
              <div>
                <label className="label">Plafond</label>
                <input value={form.ceiling||''} onChange={e=>set('ceiling',e.target.value)} className="input text-xs" placeholder="EuroLeague All-Star..." />
              </div>
              <div>
                <label className="label">Comparable</label>
                <input value={form.comparable||''} onChange={e=>set('comparable',e.target.value)} className="input text-xs" placeholder="Scoot Henderson..." />
              </div>
              <div>
                <label className="label">Saison</label>
                <input value={form.season||'2024-25'} onChange={e=>set('season',e.target.value)} className="input text-xs" />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Notes scout</div>
            <div className="grid grid-cols-1 gap-3">
              {[['Forces','strengths'],['Faiblesses','weaknesses'],['Observation terrain','observation']].map(([label,key])=>(
                <div key={key}>
                  <label className="label">{label}</label>
                  <textarea value={form[key]||''} onChange={e=>set(key,e.target.value)} rows={3} className="input text-xs resize-none" />
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Liens</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[['Photo URL','photo_url'],['Highlights','highlight_url'],['Basketball-Reference','bref_url'],['Eurobasket','eurobasket_url'],['Barttorvik','barttorvik_url']].map(([label,key])=>(
                <div key={key}>
                  <label className="label">{label}</label>
                  <input value={form[key]||''} onChange={e=>set(key,e.target.value)} className="input text-xs" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">{saving?'Sauvegarde...':'💾 Sauvegarder'}</button>
            <button onClick={()=>{setTab('stats');setForm(player)}} className="btn-ghost text-xs">Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
