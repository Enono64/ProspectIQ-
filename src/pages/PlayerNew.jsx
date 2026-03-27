import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { STATUTS, POSTES, LIGUES } from '../lib/utils'

const EMPTY = {
  first_name:'', last_name:'', nationality:'', age:'', height_cm:'', weight_kg:'',
  position:'', number:'', team:'', league:'', season:'2024-25',
  status:'🟡 À SURVEILLER', scout_grade:5, ceiling:'', comparable:'',
  gp:'', min:'', pts:'', reb:'', ast:'', stl:'', blk:'', tov:'',
  fga:'', fgm:'', fg_pct:'', fg3a:'', fg3m:'', fg3_pct:'', fta:'', ftm:'', ft_pct:'',
  per:'', bpm:'', obpm:'', dbpm:'', usg_pct:'', vorp:'', ortg:'', drtg:'',
  strengths:'', weaknesses:'', observation:'', style:'',
  photo_url:'', highlight_url:'', bref_url:'', eurobasket_url:'', barttorvik_url:'',
}

export default function PlayerNew() {
  const [form, setForm]           = useState(EMPTY)
  const [search, setSearch]       = useState('')
  const [filling, setFilling]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [fillMsg, setFillMsg]     = useState('')
  const navigate = useNavigate()

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleAutofill() {
    if (!search.trim()) return
    setFilling(true)
    setFillMsg('Agent IA en recherche...')
    try {
      const { player } = await api.autofill(search, form.league)
      // Merge uniquement les valeurs non-null
      const merged = Object.fromEntries(
        Object.entries(player).filter(([, v]) => v !== null && v !== '')
      )
      setForm(f => ({ ...f, ...merged }))
      setFillMsg('✅ Fiche remplie — vérifie et ajuste avant de sauvegarder')
    } catch (e) {
      setFillMsg(`❌ ${e.message}`)
    }
    setFilling(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '' && v !== null)
      )
      const player = await api.createPlayer(payload)
      navigate(`/players/${player.id}`)
    } catch (e) {
      alert('Erreur : ' + e.message)
    }
    setSaving(false)
  }

  const Field = ({ label, k, type = 'text', half = false }) => (
    <div className={half ? '' : 'col-span-2 sm:col-span-1'}>
      <label className="label">{label}</label>
      <input type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} className="input text-xs" />
    </div>
  )

  return (
    <div className="p-5 max-w-4xl">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="btn-ghost text-xs">← Retour</button>
        <h1 className="text-base font-semibold text-txt-primary">Nouveau joueur</h1>
      </div>

      {/* Autofill IA */}
      <div className="card p-4 mb-5 border-purple-border bg-purple-dim/30">
        <div className="text-xs text-purple-light uppercase tracking-widest mb-3">Agent IA — auto-remplissage</div>
        <div className="flex gap-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAutofill()}
            className="input text-xs flex-1"
            placeholder="Nom du joueur (ex: Victor Wembanyama)"
          />
          <select value={form.league} onChange={e => set('league', e.target.value)} className="select text-xs w-40">
            <option value="">Ligue (optionnel)</option>
            {LIGUES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={handleAutofill} disabled={filling || !search.trim()} className="btn-primary text-xs whitespace-nowrap">
            {filling ? 'Recherche...' : '🤖 Autofill'}
          </button>
        </div>
        {fillMsg && (
          <p className={`text-xs mt-2 ${fillMsg.startsWith('✅') ? 'text-teal-light' : fillMsg.startsWith('❌') ? 'text-red-light' : 'text-txt-muted animate-pulse'}`}>
            {fillMsg}
          </p>
        )}
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5">

        {/* Identité */}
        <div className="card p-4">
          <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Identité</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Prénom *" k="first_name" />
            <Field label="Nom *"    k="last_name"  />
            <Field label="Nationalité" k="nationality" />
            <Field label="Âge"         k="age" type="number" />
            <Field label="Taille (cm)" k="height_cm" type="number" />
            <Field label="Poids (kg)"  k="weight_kg" type="number" />
            <div>
              <label className="label">Poste</label>
              <select value={form.position} onChange={e => set('position', e.target.value)} className="select text-xs">
                <option value="">—</option>
                {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Field label="Numéro" k="number" />
          </div>
        </div>

        {/* Équipe */}
        <div className="card p-4">
          <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Équipe & statut</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Équipe" k="team" />
            <div>
              <label className="label">Ligue</label>
              <select value={form.league} onChange={e => set('league', e.target.value)} className="select text-xs">
                <option value="">—</option>
                {LIGUES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Statut scout</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select text-xs">
                {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Note (/10)</label>
              <input type="number" min={1} max={10} value={form.scout_grade} onChange={e => set('scout_grade', +e.target.value)} className="input text-xs" />
            </div>
            <Field label="Plafond estimé"   k="ceiling" />
            <Field label="Comparable"       k="comparable" />
            <Field label="Saison"           k="season" />
            <Field label="Style de jeu"     k="style" />
          </div>
        </div>

        {/* Stats de base */}
        <div className="card p-4">
          <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Statistiques de base</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {[
              ['GP', 'gp'], ['Min', 'min'], ['PTS', 'pts'], ['REB', 'reb'],
              ['AST', 'ast'], ['STL', 'stl'], ['BLK', 'blk'], ['TOV', 'tov'],
              ['FGA', 'fga'], ['FGM', 'fgm'], ['FG%', 'fg_pct'],
              ['3PA', 'fg3a'], ['3PM', 'fg3m'], ['3P%', 'fg3_pct'],
              ['FTA', 'fta'], ['FTM', 'ftm'], ['FT%', 'ft_pct'],
              ['+/-', 'plus_minus'],
            ].map(([label, k]) => (
              <div key={k}>
                <label className="label">{label}</label>
                <input type="number" step="0.1" value={form[k] || ''} onChange={e => set(k, e.target.value)} className="input text-xs font-mono" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-txt-muted mt-2">TS%, eFG%, Net Rating calculés automatiquement.</p>
        </div>

        {/* Stats avancées */}
        <div className="card p-4">
          <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Stats avancées</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {[
              ['BPM', 'bpm'], ['OBPM', 'obpm'], ['DBPM', 'dbpm'],
              ['VORP', 'vorp'], ['PER', 'per'], ['USG%', 'usg_pct'],
              ['ORTG', 'ortg'], ['DRTG', 'drtg'],
            ].map(([label, k]) => (
              <div key={k}>
                <label className="label">{label}</label>
                <input type="number" step="0.01" value={form[k] || ''} onChange={e => set(k, e.target.value)} className="input text-xs font-mono" />
              </div>
            ))}
          </div>
        </div>

        {/* Notes scout */}
        <div className="card p-4">
          <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Notes scout</div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="label">Forces</label>
              <textarea value={form.strengths} onChange={e => set('strengths', e.target.value)} rows={2} className="input text-xs resize-none" placeholder="Points forts du joueur..." />
            </div>
            <div>
              <label className="label">Faiblesses</label>
              <textarea value={form.weaknesses} onChange={e => set('weaknesses', e.target.value)} rows={2} className="input text-xs resize-none" placeholder="Points à améliorer..." />
            </div>
            <div>
              <label className="label">Observation terrain</label>
              <textarea value={form.observation} onChange={e => set('observation', e.target.value)} rows={3} className="input text-xs resize-none" placeholder="Tes notes d'observation..." />
            </div>
          </div>
        </div>

        {/* Liens */}
        <div className="card p-4">
          <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Liens & médias</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Photo URL"        k="photo_url"      />
            <Field label="Highlights URL"   k="highlight_url"  />
            <Field label="Basketball-Reference" k="bref_url"   />
            <Field label="Eurobasket URL"   k="eurobasket_url" />
            <Field label="Barttorvik URL"   k="barttorvik_url" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving || !form.first_name || !form.last_name} className="btn-primary">
            {saving ? 'Sauvegarde...' : '💾 Sauvegarder le joueur'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">Annuler</button>
        </div>

      </form>
    </div>
  )
}
