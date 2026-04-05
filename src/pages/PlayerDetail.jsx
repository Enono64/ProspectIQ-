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
    score_athletisme: 5, score_tir: 5, score_creation: 5,
    score_defense: 5, score_lecture: 5, score_mentalite: 5,
  })
  const [saving, setSaving] = useState(false)
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

async function exportPDF(player) {
  try {
    const { getToken } = await import('../lib/api')
    const token = await getToken()
    const resp = await fetch(
      import.meta.env.VITE_API_URL + '/players/' + player.id + '/pdf',
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (!resp.ok) throw new Error('Erreur génération PDF')
    const blob = await resp.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `rapport_${player.first_name}_${player.last_name}.pdf`.replace(/\s+/g, '_')
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('❌ ' + e.message)
  }
}
