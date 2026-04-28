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

// ── Skill level label + color ──
function skillLevel(v) {
  if (v >= 8.5) return { label: 'Excellent', color: '#00c896' }
  if (v >= 7)   return { label: 'Good',      color: '#00b87a' }
  if (v >= 5)   return { label: 'Average',   color: '#f5a623' }
  if (v >= 3)   return { label: 'Fair',      color: '#e67e22' }
  return           { label: 'Poor',      color: '#e74c3c' }
}

// ── Single skill row ──
function SkillRow({ label, value }) {
  const lvl = skillLevel(value || 0)
  const pct = ((value || 0) / 10) * 100
  return (
    <div className="flex items-center gap-2 py-1 border-b border-bg-border last:border-0">
      <span className="text-xs text-txt-secondary flex-1">{label}</span>
      <span className="text-[10px] font-medium" style={{ color: lvl.color, width: 52, textAlign: 'right', flexShrink: 0 }}>{lvl.label}</span>
      <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: lvl.color, borderRadius: 2 }} />
      </div>
      <span className="text-xs font-bold text-txt-primary" style={{ width: 28, textAlign: 'right', flexShrink: 0 }}>
        {value != null ? Number(value).toFixed(1) : '—'}
      </span>
    </div>
  )
}

// ── Section accordion ──
function ScoutSection({ title, badge, badgeColor, skills, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const avg = skills.filter(s => s.value != null).reduce((a, s, _, arr) => a + s.value / arr.length, 0)
  const lvl = skillLevel(avg)
  const badgeColors = {
    green:  { bg: 'rgba(0,200,150,0.15)', text: '#00c896' },
    orange: { bg: 'rgba(245,166,35,0.15)', text: '#f5a623' },
    red:    { bg: 'rgba(231,76,60,0.15)', text: '#e74c3c' },
  }
  const bc = badgeColors[badgeColor] || badgeColors.green

  return (
    <div className="border border-bg-border rounded-lg overflow-hidden mb-2">
      <div
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-bg-card transition-colors"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <span className="text-xs font-semibold text-txt-primary">{title}</span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: bc.bg, color: bc.text }}>
              {badge}
            </span>
          )}
          <span className="text-[10px] text-txt-muted">{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="px-3 pb-1 pt-1">
          {skills.map(s => <SkillRow key={s.label} label={s.label} value={s.value} />)}
        </div>
      )}
    </div>
  )
}

// ── Build scouting categories from report ──
function buildCategories(report) {
  if (!report) return []
  return [
    {
      title: 'Interior Physical Profile',
      badge: 'Avg (5.6/10)', badgeColor: 'orange',
      skills: [
        { label: 'Size for position',              value: report.size_for_position },
        { label: 'Wingspan',                       value: report.wingspan },
        { label: 'Functional strength',            value: report.functional_strength },
        { label: 'Lateral mobility',               value: report.lateral_mobility },
        { label: 'Coordination and agility',       value: report.coordination_agility },
        { label: 'Defensive verticality',          value: report.defensive_verticality },
        { label: 'Resistance to constant contact', value: report.resistance_contact },
        { label: 'Durability',                     value: report.durability },
      ]
    },
    {
      title: 'Offensive Post Game',
      badge: 'Good (6.8/10)', badgeColor: 'green',
      skills: [
        { label: 'Back to basket play',        value: report.back_to_basket },
        { label: 'Post sealing & positioning', value: report.post_sealing },
        { label: 'Roll Man in P&R',            value: report.roll_man_pnr },
        { label: 'Finishing in traffic',       value: report.finishing_traffic },
        { label: 'Touch near the rim',         value: report.touch_near_rim },
        { label: 'Offensive rebounding',       value: report.offensive_rebounding },
        { label: 'Second chance scoring',      value: report.second_chance_scoring },
        { label: 'Short roll decision making', value: report.short_roll_decision },
        { label: 'High post play',             value: report.high_post_play },
        { label: 'Free Throw',                 value: report.free_throw },
      ]
    },
    {
      title: 'Modern Big Skills',
      badge: 'Fair (4.4/10)', badgeColor: 'orange',
      skills: [
        { label: 'Pick & Pop',                value: report.pick_pop },
        { label: '3-point shooting',          value: report.three_point_shooting },
        { label: 'Hand-off play (DHO)',        value: report.hand_off_dho },
        { label: 'High post passing',         value: report.high_post_passing },
        { label: 'Defensive help reading',    value: report.defensive_help_reading },
        { label: 'Closeout attack',           value: report.closeout_attack },
        { label: 'Real floor-spacing ability',value: report.floor_spacing },
      ]
    },
    {
      title: 'Defensive Anchor',
      badge: 'Good (6.9/10)', badgeColor: 'green',
      skills: [
        { label: 'Rim protection',                       value: report.rim_protection },
        { label: 'Shot-blocking timing',                 value: report.shot_blocking_timing },
        { label: 'Defensive rebounding',                 value: report.defensive_rebounding },
        { label: 'Box out',                              value: report.box_out },
        { label: 'Drop coverage',                        value: report.drop_coverage },
        { label: 'Hedge/show defense',                   value: report.hedge_show_defense },
        { label: 'Switching ability',                    value: report.switching_ability },
        { label: 'Defensive communication',              value: report.defensive_communication },
        { label: 'Impact on team defensive efficiency',  value: report.team_defensive_impact },
        { label: 'Defense without unnecessary fouls',    value: report.defense_no_fouls },
      ]
    },
    {
      title: 'Interior Mentality',
      badge: 'Avg (6.8/10)', badgeColor: 'orange',
      skills: [
        { label: 'Physical toughness',               value: report.physical_toughness },
        { label: 'Tactical discipline',              value: report.tactical_discipline },
        { label: 'Constancy',                        value: report.constancy },
        { label: 'Defensive IQ',                    value: report.defensive_iq },
        { label: 'Role within the system',           value: report.role_system },
        { label: 'Competing under constant contact', value: report.competing_contact },
      ]
    },
  ]
}

// ── Category summary bar ──
function CatSummaryRow({ name, avg, total, pct, color }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] text-txt-muted" style={{ width: 110, flexShrink: 0 }}>{name}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: ((avg||0)/10*100)+'%', height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span className="text-[10px] font-semibold text-txt-primary" style={{ width: 32, textAlign: 'right', flexShrink: 0 }}>
        {avg != null ? Number(avg).toFixed(1) : '—'}
      </span>
      <span className="text-[10px] text-txt-muted" style={{ width: 32, textAlign: 'right', flexShrink: 0 }}>
        {pct != null ? `(${pct}%)` : ''}
      </span>
    </div>
  )
}

// ── Player card gradient ──
function PlayerCard({ player }) {
  const pos = player.position || '?'
  const rating = player.scout_grade

  // gradient by position
  const gradients = {
    PG: 'linear-gradient(135deg,#6a11cb,#2575fc)',
    SG: 'linear-gradient(135deg,#1a6fc4,#00c6fb)',
    SF: 'linear-gradient(135deg,#f7971e,#ffd200)',
    PF: 'linear-gradient(135deg,#e65c00,#f9d423)',
    C:  'linear-gradient(135deg,#134e5e,#71b280)',
  }
  const basePos = pos.split('/')[0]
  const gradient = gradients[basePos] || 'linear-gradient(135deg,#c17a00,#f5b800)'

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: gradient, position: 'relative' }}>
      <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Photo */}
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
          {player.photo_url
            ? <img src={player.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : `${player.first_name?.[0]||''}${player.last_name?.[0]||''}`
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          {/* Stars */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ fontSize: 11, color: i <= Math.round((rating||5)/2) ? '#fff' : 'rgba(255,255,255,0.3)' }}>★</span>
            ))}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            {player.first_name} {player.last_name}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {player.league && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: 'rgba(0,0,0,0.3)', color: '#fff' }}>{player.league}</span>}
            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: 'rgba(0,0,0,0.4)', color: '#fff' }}>{pos}</span>
            {player.status && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: 'rgba(0,184,122,0.8)', color: '#fff' }}>{player.status}</span>}
          </div>
        </div>

        {/* Rating */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>Rating</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{rating ? Number(rating).toFixed(2) : '—'}</div>
        </div>
      </div>

      {/* Info row */}
      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.15)', padding: '8px 16px', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Age', value: player.age ? `${player.age} ans` : '—' },
          { label: 'Height', value: player.height_cm ? `${player.height_cm} cm` : '—' },
          { label: 'Nationality', value: player.nationality || '—' },
          { label: 'Hand', value: player.dominant_hand || 'R' },
        ].map(item => (
          <div key={item.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>{item.label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.15)', padding: '8px 16px', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'License', value: player.license || '—' },
          { label: 'Team', value: player.team || '—' },
          { label: 'National League', value: player.league || '—' },
          { label: 'Weight', value: player.weight_kg ? `${player.weight_kg} kg` : '—' },
        ].map(item => (
          <div key={item.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>{item.label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stats block (Statistics tab) ──
function StatsBlock({ player }) {
  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-txt-muted uppercase tracking-widest">Statistics (Real GM)</span>
        <span className="text-[10px] text-acc font-medium">Current season {player.season || '2024-25'}</span>
      </div>
      <div className="grid grid-cols-3 gap-0 border border-bg-border rounded-lg overflow-hidden mb-3">
        {[
          { label: 'Min/Game', value: player.min },
          { label: 'Points',   value: player.pts },
          { label: 'Rebounds', value: player.reb },
        ].map((s, i, arr) => (
          <div key={s.label} className={`p-3 text-center ${i < arr.length-1 ? 'border-r border-bg-border' : ''}`}>
            <div className="text-[10px] text-txt-muted mb-1">{s.label}</div>
            <div className="text-xl font-semibold text-txt-primary">{s.value != null ? Number(s.value).toFixed(1) : '—'}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-0 border border-bg-border rounded-lg overflow-hidden mb-3">
        {[
          { label: 'Assists', value: player.ast },
          { label: 'Steals',  value: player.stl },
          { label: 'Blocks',  value: player.blk },
        ].map((s, i, arr) => (
          <div key={s.label} className={`p-3 text-center ${i < arr.length-1 ? 'border-r border-bg-border' : ''}`}>
            <div className="text-[10px] text-txt-muted mb-1">{s.label}</div>
            <div className="text-lg font-semibold text-txt-primary">{s.value != null ? Number(s.value).toFixed(1) : '—'}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-0 border border-bg-border rounded-lg overflow-hidden">
        {[
          { label: 'FG %',  value: player.fg_pct  != null ? Number(player.fg_pct).toFixed(1)+'%'  : '—' },
          { label: 'FT %',  value: player.ft_pct  != null ? Number(player.ft_pct).toFixed(1)+'%'  : '—' },
        ].map((s, i, arr) => (
          <div key={s.label} className={`p-3 text-center ${i < arr.length-1 ? 'border-r border-bg-border' : ''}`}>
            <div className="text-[10px] text-txt-muted mb-1">{s.label}</div>
            <div className="text-lg font-semibold text-txt-primary">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Scouting report right panel ──
function ScoutingReportPanel({ player, report }) {
  const categories = buildCategories(report)
  const catColors = ['#00c896','#f5a623','#e67e22','#00b87a','#f5a623']

  const catSummary = categories.map((cat, i) => {
    const vals = cat.skills.filter(s => s.value != null)
    const avg  = vals.length ? vals.reduce((a,s) => a+s.value, 0)/vals.length : null
    return { name: cat.title.split(' ').slice(0,2).join(' '), avg, color: catColors[i] }
  })
  const overallAvg = catSummary.filter(c => c.avg != null).reduce((a,c,_,arr) => a+c.avg/arr.length, 0)

  const hasReport = report && categories.some(cat => cat.skills.some(s => s.value != null))

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#1e2433', borderRadius: '8px 8px 0 0', padding: '10px 14px', marginBottom: 2 }}>
        <div className="text-xs font-semibold text-white">
          Bigs ({player.position || 'PF/C'}) — Scouting Report
        </div>
      </div>

      {!hasReport ? (
        <div className="card p-6 text-center rounded-t-none">
          <div className="text-txt-muted text-sm mb-2">Aucun rapport de scouting</div>
          <div className="text-xs text-txt-muted">Génère un rapport IA ou remplis les données manuellement</div>
        </div>
      ) : (
        <>
          {categories.map((cat, i) => (
            <ScoutSection
              key={cat.title}
              title={cat.title}
              badge={cat.badge}
              badgeColor={cat.badgeColor}
              skills={cat.skills}
              defaultOpen={i === 0}
            />
          ))}

          {/* Category Summary */}
          <div style={{ background: '#1e2433', borderRadius: 8, padding: 14, marginTop: 8 }}>
            <div className="text-xs font-semibold text-white mb-3">Category Summary</div>
            {catSummary.map((cat, i) => (
              <CatSummaryRow
                key={cat.name}
                name={cat.name}
                avg={cat.avg}
                pct={cat.avg != null ? Math.round(cat.avg/10*100) : null}
                color={cat.color}
              />
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-xs font-medium text-txt-muted">Overall Rating</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#00b87a' }}>{overallAvg.toFixed(1)} / 10</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Report form (unchanged) ──
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
  const [player, setPlayer]               = useState(null)
  const [loading, setLoading]             = useState(true)
  const [syncing, setSyncing]             = useState(false)
  const [aiLoading, setAiLoading]         = useState(false)
  const [tab, setTab]                     = useState('stats')
  const [saving, setSaving]               = useState(false)
  const [showReportForm, setShowReportForm] = useState(false)
  const [showInstat, setShowInstat]       = useState(false)
  const [form, setForm]                   = useState({})

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

  async function handleInstatImport(stats) {
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

  const reports   = player.reports || []
  const latestReport = reports[0] || null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-bg-surface border-b border-bg-border px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate(-1)} className="btn-ghost text-xs">← Retour</button>
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

        {showInstat && (
          <div className="mt-3">
            <ImportInstat playerId={id} onImport={handleInstatImport} onClose={() => setShowInstat(false)} />
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

      {/* ── Contenu ── */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ── Tab Stats — layout El Radar del Scout ── */}
        {tab === 'stats' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT */}
            <div>
              <PlayerCard player={player} />
              <StatsBlock player={player} />

              {/* Scout's notes */}
              {(player.observation || player.strengths || player.weaknesses) && (
                <div className="card p-4 mb-3">
                  <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Scout's notes</div>
                  {player.strengths && (
                    <div className="mb-2">
                      <div className="text-[10px] text-teal uppercase tracking-widest mb-1">Offense</div>
                      <p className="text-xs text-txt-secondary leading-relaxed">{player.strengths}</p>
                    </div>
                  )}
                  {player.weaknesses && (
                    <div className="mb-2">
                      <div className="text-[10px] text-red uppercase tracking-widest mb-1">Defense</div>
                      <p className="text-xs text-txt-secondary leading-relaxed">{player.weaknesses}</p>
                    </div>
                  )}
                  {player.observation && (
                    <p className="text-xs text-txt-secondary leading-relaxed mt-2">{player.observation}</p>
                  )}
                </div>
              )}

              {/* Radar chart */}
              <div className="card p-4">
                <RadarChart player={player} />
              </div>
            </div>

            {/* RIGHT — Scouting Report */}
            <div>
              <ScoutingReportPanel player={player} report={latestReport} />
            </div>
          </div>
        )}

        {tab === 'fit' && <FitAnalysis player={player} />}
        {tab === 'gpt' && <GPTAnalysis player={player} />}

        {tab === 'scout' && (
          <div className="flex flex-col gap-4">
            {player.comparable && <div className="card p-4"><div className="text-[10px] text-txt-muted uppercase tracking-widest mb-1">Comparable</div><div className="text-sm text-acc font-medium">{player.comparable}</div></div>}
            {player.ceiling && <div className="card p-4"><div className="text-[10px] text-txt-muted uppercase tracking-widest mb-1">Plafond estimé</div><div className="text-sm text-txt-primary">{player.ceiling}</div></div>}
            {player.strengths && <div className="card p-4 border-teal/20 bg-teal/5"><div className="text-[10px] text-teal uppercase tracking-widest mb-2">Forces</div><p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.strengths}</p></div>}
            {player.weaknesses && <div className="card p-4 border-red/20 bg-red/5"><div className="text-[10px] text-red uppercase tracking-widest mb-2">Faiblesses</div><p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.weaknesses}</p></div>}
            {player.observation && <div className="card p-4"><div className="text-[10px] text-txt-muted uppercase tracking-widest mb-2">Observation terrain</div><p className="text-sm text-txt-secondary whitespace-pre-wrap leading-relaxed">{player.observation}</p></div>}
            {!player.strengths && !player.weaknesses && !player.observation && <div className="card p-10 text-center text-txt-muted text-sm">Aucune note — <button onClick={() => setTab('edit')} className="text-acc hover:underline">ajouter</button></div>}
          </div>
        )}

        {tab === 'reports' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReportForm(!showReportForm)} className="btn-ghost text-xs">{showReportForm ? '✕ Annuler' : '📋 Rapport manuel'}</button>
              <button onClick={handleAIReport} disabled={aiLoading} className="btn-primary text-xs">{aiLoading ? '🤖 Génération...' : '🤖 Rapport IA'}</button>
            </div>
            {showReportForm && <ReportForm playerId={id} onSaved={() => { setShowReportForm(false); load() }} onCancel={() => setShowReportForm(false)} />}
            {reports.length === 0 && !showReportForm
              ? <div className="card p-10 text-center text-txt-muted text-sm">Aucun rapport</div>
              : reports.map(r => (
                <div key={r.id} className={`card p-4 ${r.source === 'IA' ? 'border-purple/20 bg-purple/5' : 'border-teal/20 bg-teal/5'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-widest font-medium ${r.source === 'IA' ? 'text-purple' : 'text-teal'}`}>{r.source === 'IA' ? '🤖 Rapport IA' : '📋 Rapport manuel'}</span>
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
                  {(r.ai_report || r.observation) && <div className="mt-2 pt-2 border-t border-bg-border"><p className="text-xs text-txt-secondary whitespace-pre-wrap leading-relaxed">{r.ai_report || r.observation}</p></div>}
                  {r.recommendation && <div className="mt-2 pt-2 border-t border-bg-border"><span className="text-xs font-medium text-acc">{r.recommendation}</span></div>}
                  {r.video_url && <a href={r.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple hover:underline mt-2 block">🎬 Highlights ↗</a>}
                </div>
              ))
            }
          </div>
        )}

        {tab === 'seasons'  && <SeasonStats playerId={id} />}
        {tab === 'contract' && <ContractTracker player={player} onUpdate={p => { setPlayer(p); setForm(p) }} />}
        {tab === 'tags'     && <TagsManager player={player} onUpdate={p => { setPlayer(p); setForm(p) }} />}

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
