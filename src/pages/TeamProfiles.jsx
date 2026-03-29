import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { getBadgeClass, gradeColor, fmt, LEAGUE_COLOR, POSTES, LIGUES } from '../lib/utils'

const PLAYING_STYLES = [
  '3&D Wing', 'Playmaker', 'Primary Scorer', 'Floor Spacer',
  'Rim Protector', 'Two-Way', 'Point Forward', 'Stretch Big',
  'Connector', 'PnR Handler', 'Catch & Shoot', 'Post Player',
]

const EMPTY_PROFILE = {
  name: '',
  team: '',
  league: '',
  description: '',
  positions: [],
  styles: [],
  min_grade: 6,
  max_age: 28,
  min_pts: '',
  min_ast: '',
  min_reb: '',
  max_usg: '',
  min_ts: '',
  min_bpm: '',
}

function ProfileCard({ profile, players, onEdit, onDelete }) {
  const matched = players.filter(p => {
    if (profile.positions?.length && !profile.positions.includes(p.position?.split('/')?.[0])) return false
    if (profile.min_grade && p.scout_grade < profile.min_grade) return false
    if (profile.max_age && p.age > profile.max_age) return false
    if (profile.min_pts && p.pts < profile.min_pts) return false
    if (profile.min_ast && p.ast < profile.min_ast) return false
    if (profile.min_reb && p.reb < profile.min_reb) return false
    if (profile.max_usg && p.usg_pct > profile.max_usg) return false
    if (profile.min_ts && p.ts_pct < profile.min_ts) return false
    if (profile.min_bpm && p.bpm < profile.min_bpm) return false
    return true
  }).sort((a, b) => b.scout_grade - a.scout_grade)

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold text-txt-primary">{profile.name}</div>
          {profile.team && (
            <div className="text-[10px] text-txt-muted mt-0.5">
              {profile.team} {profile.league && <span style={{ color: LEAGUE_COLOR[profile.league] || '#888' }}>· {profile.league}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(profile)} className="text-txt-muted hover:text-txt-primary text-xs transition-colors">✏️</button>
          <button onClick={() => onDelete(profile.id)} className="text-txt-muted hover:text-red text-xs transition-colors">✕</button>
        </div>
      </div>

      {profile.description && (
        <p className="text-xs text-txt-secondary leading-relaxed">{profile.description}</p>
      )}

      {/* Critères */}
      <div className="flex flex-wrap gap-1.5">
        {profile.positions?.map(p => (
          <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-purple/10 text-purple border border-purple/20">{p}</span>
        ))}
        {profile.styles?.map(s => (
          <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-blue/10 text-blue border border-blue/20">{s}</span>
        ))}
        {profile.min_grade > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber/10 text-amber border border-amber/20">Note ≥ {profile.min_grade}</span>
        )}
        {profile.max_age && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-bg-hover text-txt-secondary border border-bg-border2">≤ {profile.max_age} ans</span>
        )}
        {profile.min_pts && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal/10 text-teal border border-teal/20">PTS ≥ {profile.min_pts}</span>
        )}
        {profile.max_usg && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-bg-hover text-txt-secondary border border-bg-border2">USG ≤ {profile.max_usg}%</span>
        )}
        {profile.min_bpm && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal/10 text-teal border border-teal/20">BPM ≥ {profile.min_bpm}</span>
        )}
      </div>

      {/* Joueurs correspondants */}
      <div>
        <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-2">
          {matched.length} joueur{matched.length > 1 ? 's' : ''} correspondant{matched.length > 1 ? 's' : ''}
        </div>
        {matched.length === 0 ? (
          <div className="text-xs text-txt-muted py-2">Aucun joueur ne correspond à ces critères</div>
        ) : (
          <div className="flex flex-col gap-1">
            {matched.slice(0, 5).map(p => (
              <Link key={p.id} to={`/players/${p.id}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-hover transition-colors group">
                <div className="w-6 h-6 rounded bg-bg-hover border border-bg-border2 flex items-center justify-center text-[9px] font-bold text-txt-muted flex-shrink-0">
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-txt-primary group-hover:text-acc transition-colors truncate">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-[10px] text-txt-muted">{p.position} · {p.team}</div>
                </div>
                <span className={`mono text-xs font-bold flex-shrink-0 ${gradeColor(p.scout_grade)}`}>{p.scout_grade}</span>
                <span className={getBadgeClass(p.status)}>{p.status}</span>
              </Link>
            ))}
            {matched.length > 5 && (
              <div className="text-[10px] text-txt-muted text-center py-1">+{matched.length - 5} autres</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileForm({ profile, onSave, onCancel }) {
  const [form, setForm] = useState(profile || EMPTY_PROFILE)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function toggleArr(k, v) {
    setForm(f => ({
      ...f,
      [k]: f[k]?.includes(v) ? f[k].filter(x => x !== v) : [...(f[k] || []), v]
    }))
  }

  return (
    <div className="card p-4 border-acc/20 bg-acc/5 flex flex-col gap-4">
      <div className="text-xs text-acc uppercase tracking-widest font-semibold">
        {profile?.id ? '✏️ Modifier le profil' : '+ Nouveau profil d\'équipe'}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nom du profil *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="input text-xs" placeholder="ex: PG 3&D Monaco" />
        </div>
        <div>
          <label className="label">Équipe cible</label>
          <input value={form.team} onChange={e => set('team', e.target.value)} className="input text-xs" placeholder="ex: AS Monaco" />
        </div>
        <div className="col-span-2">
          <label className="label">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={2} className="input text-xs resize-none"
            placeholder="Ce profil correspond à un meneur défensif capable d'espacer le terrain..." />
        </div>
      </div>

      {/* Postes */}
      <div>
        <label className="label">Postes recherchés</label>
        <div className="flex flex-wrap gap-1.5">
          {POSTES.map(p => (
            <button key={p} onClick={() => toggleArr('positions', p)}
              className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
                form.positions?.includes(p)
                  ? 'bg-purple/20 text-purple border-purple/40'
                  : 'bg-bg-hover text-txt-muted border-bg-border2 hover:border-purple/30'
              }`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Styles */}
      <div>
        <label className="label">Styles de jeu recherchés</label>
        <div className="flex flex-wrap gap-1.5">
          {PLAYING_STYLES.map(s => (
            <button key={s} onClick={() => toggleArr('styles', s)}
              className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
                form.styles?.includes(s)
                  ? 'bg-blue/20 text-blue border-blue/40'
                  : 'bg-bg-hover text-txt-muted border-bg-border2 hover:border-blue/30'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Critères stats */}
      <div>
        <label className="label">Critères statistiques</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Note min (/10)', 'min_grade', 'number'],
            ['Âge max', 'max_age', 'number'],
            ['PTS min', 'min_pts', 'number'],
            ['AST min', 'min_ast', 'number'],
            ['REB min', 'min_reb', 'number'],
            ['USG% max', 'max_usg', 'number'],
            ['TS% min', 'min_ts', 'number'],
            ['BPM min', 'min_bpm', 'number'],
          ].map(([label, key, type]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input type={type} step="0.1" value={form[key] || ''} onChange={e => set(key, e.target.value ? +e.target.value : '')}
                className="input text-xs mono" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => onSave(form)} disabled={!form.name} className="btn-primary text-xs">
          💾 Sauvegarder
        </button>
        <button onClick={onCancel} className="btn-ghost text-xs">Annuler</button>
      </div>
    </div>
  )
}

export default function TeamProfiles() {
  const [players, setPlayers]   = useState([])
  const [profiles, setProfiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prospectiq_profiles') || '[]') }
    catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [editProfile, setEditProfile] = useState(null)

  useEffect(() => {
    api.getPlayers().then(setPlayers).catch(() => {})
  }, [])

  function saveProfiles(updated) {
    setProfiles(updated)
    localStorage.setItem('prospectiq_profiles', JSON.stringify(updated))
  }

  function handleSave(form) {
    if (form.id) {
      saveProfiles(profiles.map(p => p.id === form.id ? form : p))
    } else {
      saveProfiles([...profiles, { ...form, id: Date.now().toString() }])
    }
    setShowForm(false)
    setEditProfile(null)
  }

  function handleEdit(profile) {
    setEditProfile(profile)
    setShowForm(true)
  }

  function handleDelete(id) {
    if (!confirm('Supprimer ce profil ?')) return
    saveProfiles(profiles.filter(p => p.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-[50px] bg-bg-surface border-b border-bg-border flex items-center px-5 gap-4 flex-shrink-0">
        <div>
          <div className="text-sm font-bold tracking-wider text-txt-primary">Profils d'équipe</div>
          <div className="text-[10px] text-txt-muted">Classe les joueurs selon les besoins d'une équipe</div>
        </div>
        <button onClick={() => { setEditProfile(null); setShowForm(!showForm) }} className="ml-auto btn-primary text-xs py-1.5 px-3">
          {showForm ? '✕ Annuler' : '+ Nouveau profil'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 max-w-4xl">
          {showForm && (
            <ProfileForm
              profile={editProfile}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditProfile(null) }}
            />
          )}

          {profiles.length === 0 && !showForm ? (
            <div className="card p-12 text-center">
              <div className="text-3xl mb-3">🏢</div>
              <div className="text-sm font-semibold text-txt-primary mb-2">Aucun profil d'équipe</div>
              <div className="text-xs text-txt-muted mb-4">
                Crée des profils pour classer automatiquement tes joueurs selon les besoins d'une équipe.
                Ex: "Monaco cherche un PG 3&D avec USG &lt; 20%"
              </div>
              <button onClick={() => setShowForm(true)} className="btn-primary text-xs">
                + Créer le premier profil
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {profiles.map(profile => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  players={players}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
