import { useState } from 'react'
import { api } from '../lib/api'

const SYSTEMS = [
  { id: 'pace_space', label: 'Pace & Space', desc: 'Jeu rapide, spacing 3PT', icon: '⚡', color: '#ff4500' },
  { id: 'half_court', label: 'Demi-terrain', desc: 'Systèmes structurés, ISO, PnR', icon: '🎯', color: '#4488ff' },
  { id: 'defense', label: 'Défense First', desc: 'Basse pace, priorité défensive', icon: '🛡️', color: '#00c896' },
  { id: 'motion', label: 'Motion Offense', desc: 'Mouvement de balle, cuts', icon: '🔄', color: '#9966ff' },
  { id: 'transition', label: 'Transition', desc: 'Fast break, contre-attaque', icon: '🏃', color: '#ffaa00' },
]

const ROLES = [
  { id: 'primary_scorer', label: 'Créateur principal', icon: '⭐' },
  { id: 'secondary_scorer', label: 'Scoreur secondaire', icon: '🔥' },
  { id: 'playmaker', label: 'Meneur / Facilitateur', icon: '🎯' },
  { id: 'three_d', label: '3&D Specialist', icon: '🏹' },
  { id: 'rim_protector', label: 'Protecteur de cercle', icon: '🛡️' },
  { id: 'rebounder', label: 'Rebondeur dominant', icon: '💪' },
  { id: 'connector', label: 'Connector / Role player', icon: '🔗' },
]

export default function FitAnalysis({ player }) {
  const [loading, setLoading]   = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError]       = useState('')

  async function runAnalysis() {
    setLoading(true); setError(''); setAnalysis(null)
    try {
      const { supabase } = await import('../lib/api')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const resp = await fetch(import.meta.env.VITE_API_URL + '/players/' + player.id + '/fit-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error)
      setAnalysis(data.analysis)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const hasStats = player.pts || player.ast || player.reb

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-txt-primary">Fit Analysis — {player.first_name} {player.last_name}</div>
          <div className="text-xs text-txt-muted mt-0.5">Analyse IA du style de jeu et compatibilité système</div>
        </div>
        <button onClick={runAnalysis} disabled={loading || !hasStats} className="btn-primary text-xs">
          {loading ? '🤖 Analyse...' : '🎯 Analyser'}
        </button>
      </div>

      {!hasStats && (
        <div className="card p-4 text-center text-sm text-txt-muted">
          Importe les stats InStat ou lance un autofill pour activer le Fit Analysis
        </div>
      )}

      {error && <div className="text-red text-xs bg-red/5 border border-red/20 rounded-lg p-3">{error}</div>}

      {loading && (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3 animate-pulse">🎯</div>
          <div className="text-sm text-txt-secondary">Analyse du profil de jeu en cours...</div>
          <div className="text-xs text-txt-muted mt-1">Tempo · Rôle · Systèmes · Compatibilité</div>
        </div>
      )}

      {analysis && (
        <div className="flex flex-col gap-4">

          {/* Tempo */}
          <div className="card p-4">
            <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">⚡ Tempo de jeu idéal</div>
            <div className="flex gap-2 mb-3">
              {analysis.tempo_scores && Object.entries(analysis.tempo_scores).map(([key, score]) => (
                <div key={key} className="flex-1 text-center">
                  <div className="text-xs text-txt-muted mb-1">{key === 'fast' ? 'Rapide' : key === 'slow' ? 'Lent' : 'Mixte'}</div>
                  <div className="h-2 bg-bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: score + '%', background: score > 60 ? '#ff4500' : score > 40 ? '#ffaa00' : '#444' }} />
                  </div>
                  <div className="text-xs mono mt-1 text-txt-secondary">{score}%</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-txt-secondary">{analysis.tempo_note}</p>
          </div>

          {/* Rôle idéal */}
          <div className="card p-4">
            <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">🎭 Rôle idéal</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {analysis.ideal_roles?.map(role => {
                const r = ROLES.find(x => x.id === role.id) || { icon: '•', label: role.id }
                return (
                  <div key={role.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${role.primary ? 'border-acc/40 bg-acc/10 text-acc' : 'border-bg-border2 bg-bg-hover text-txt-secondary'}`}>
                    <span>{r.icon}</span> {r.label}
                    {role.primary && <span className="text-[9px] ml-1 text-acc/70">PRIMAIRE</span>}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-txt-secondary">{analysis.role_note}</p>
          </div>

          {/* Systèmes compatibles */}
          <div className="card p-4">
            <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">⚙️ Systèmes compatibles</div>
            <div className="flex flex-col gap-2">
              {analysis.systems?.map(sys => {
                const s = SYSTEMS.find(x => x.id === sys.id) || { icon: '•', label: sys.id, color: '#888' }
                return (
                  <div key={sys.id} className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center">{s.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-txt-primary">{s.label}</span>
                        <span className="text-xs mono" style={{ color: s.color }}>{sys.score}%</span>
                      </div>
                      <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: sys.score + '%', background: s.color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-txt-secondary mt-3">{analysis.systems_note}</p>
          </div>

          {/* Comparable NBA */}
          {analysis.nba_comparable && (
            <div className="card p-4 border-purple/20 bg-purple/5">
              <div className="text-[10px] text-purple uppercase tracking-widest mb-2">🏀 Comparable NBA</div>
              <div className="text-sm font-bold text-txt-primary">{analysis.nba_comparable.name}</div>
              <p className="text-xs text-txt-secondary mt-1">{analysis.nba_comparable.reason}</p>
            </div>
          )}

          {/* Points forts / faibles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 border-teal/20">
              <div className="text-[10px] text-teal uppercase tracking-widest mb-2">✅ Forces</div>
              <ul className="flex flex-col gap-1">
                {analysis.strengths?.map((s, i) => (
                  <li key={i} className="text-xs text-txt-secondary flex gap-1.5"><span className="text-teal">+</span>{s}</li>
                ))}
              </ul>
            </div>
            <div className="card p-4 border-red/20">
              <div className="text-[10px] text-red uppercase tracking-widest mb-2">⚠️ Limites</div>
              <ul className="flex flex-col gap-1">
                {analysis.weaknesses?.map((w, i) => (
                  <li key={i} className="text-xs text-txt-secondary flex gap-1.5"><span className="text-red">−</span>{w}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Verdict */}
          <div className="card p-4 border-acc/20 bg-acc/5">
            <div className="text-[10px] text-acc uppercase tracking-widest mb-2">🏆 Verdict scout</div>
            <p className="text-sm text-txt-primary font-medium">{analysis.verdict}</p>
          </div>

        </div>
      )}
    </div>
  )
}
