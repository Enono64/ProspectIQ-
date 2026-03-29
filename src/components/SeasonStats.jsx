import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { fmt, LEAGUE_COLOR, LIGUES } from '../lib/utils'

const STAT_COLS = [
  { key: 'gp',      label: 'GP',   type: 'int' },
  { key: 'min',     label: 'MIN',  type: 'float' },
  { key: 'pts',     label: 'PTS',  type: 'float', highlight: true },
  { key: 'reb',     label: 'REB',  type: 'float' },
  { key: 'ast',     label: 'AST',  type: 'float', highlight: true },
  { key: 'stl',     label: 'STL',  type: 'float' },
  { key: 'blk',     label: 'BLK',  type: 'float' },
  { key: 'tov',     label: 'TOV',  type: 'float' },
  { key: 'fg_pct',  label: 'FG%',  type: 'pct' },
  { key: 'fg3_pct', label: '3P%',  type: 'pct' },
  { key: 'ft_pct',  label: 'FT%',  type: 'pct' },
  { key: 'ts_pct',  label: 'TS%',  type: 'pct', highlight: true },
  { key: 'usg_pct', label: 'USG%', type: 'pct' },
  { key: 'bpm',     label: 'BPM',  type: 'float' },
  { key: 'net_rtg', label: 'NET',  type: 'float' },
  { key: 'plus_minus', label: '+/-', type: 'float' },
]

// Cellule éditable inline
function EditableCell({ value, col, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value ?? '')
  const inputRef              = useRef()

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function handleKey(e) {
    if (e.key === 'Enter') { commit(); }
    if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false) }
  }

  function commit() {
    const parsed = val === '' ? null : col.type === 'int' ? parseInt(val) : parseFloat(val)
    onSave(col.key, isNaN(parsed) ? null : parsed)
    setEditing(false)
  }

  const display = value != null ? (col.type === 'pct' ? `${fmt(value)}` : col.key === 'bpm' || col.key === 'net_rtg' ? (value >= 0 ? '+' : '') + fmt(value) : fmt(value)) : '—'
  const color = col.highlight ? 'text-teal' : col.key === 'bpm' || col.key === 'net_rtg' ? (value > 0 ? 'text-teal' : value < 0 ? 'text-red' : 'text-txt-secondary') : 'text-txt-secondary'

  if (editing) return (
    <td className="px-2 py-1.5">
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        className="w-14 bg-acc/10 border border-acc/40 rounded px-1 py-0.5 text-xs mono text-center text-acc outline-none"
      />
    </td>
  )

  return (
    <td
      className="px-2 py-1.5 cursor-pointer group/cell"
      onClick={() => { setVal(value ?? ''); setEditing(true) }}
      title="Cliquer pour modifier"
    >
      <span className={`mono text-xs ${color} group-hover/cell:bg-bg-hover group-hover/cell:rounded px-1 py-0.5 transition-colors`}>
        {display}
      </span>
    </td>
  )
}

// Formulaire nouvelle saison
function NewSeasonForm({ playerId, onSaved, onCancel }) {
  const [form, setForm] = useState({ season: '2025-26', league: '', team: '', source: 'manual' })
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.league) return alert('Ligue requise')
    setSaving(true)
    try {
      await api.createSeason(playerId, form)
      onSaved()
    } catch (e) { alert('Erreur : ' + e.message) }
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-acc/5 border border-acc/20 rounded-lg">
      <input value={form.season} onChange={e => set('season', e.target.value)}
        className="input text-xs w-24 mono" placeholder="2025-26" />
      <select value={form.league} onChange={e => set('league', e.target.value)} className="select text-xs flex-1">
        <option value="">Ligue *</option>
        {LIGUES.map(l => <option key={l}>{l}</option>)}
      </select>
      <input value={form.team} onChange={e => set('team', e.target.value)}
        className="input text-xs flex-1" placeholder="Équipe" />
      <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
        {saving ? '...' : '+ Ajouter'}
      </button>
      <button onClick={onCancel} className="btn-ghost text-xs">✕</button>
    </div>
  )
}

export default function SeasonStats({ playerId }) {
  const [seasons, setSeasons]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)

  useEffect(() => { load() }, [playerId])

  async function load() {
    setLoading(true)
    const data = await api.getSeasons(playerId).catch(() => [])
    setSeasons(data || [])
    setLoading(false)
  }

  async function handleStatSave(seasonId, key, value) {
    await api.updateSeason(seasonId, { [key]: value }).catch(e => alert(e.message))
    setSeasons(prev => prev.map(s => s.id === seasonId ? { ...s, [key]: value } : s))
  }

  async function handleDelete(seasonId) {
    if (!confirm('Supprimer cette ligne de stats ?')) return
    await api.deleteSeason(seasonId)
    setSeasons(prev => prev.filter(s => s.id !== seasonId))
  }

  if (loading) return <div className="text-txt-muted text-xs animate-pulse p-4">Chargement des saisons...</div>

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-txt-muted uppercase tracking-widest">
          Stats par ligue · cliquer sur un chiffre pour modifier
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-ghost text-xs">
          {showForm ? '✕' : '+ Ajouter une ligne'}
        </button>
      </div>

      {showForm && (
        <NewSeasonForm
          playerId={playerId}
          onSaved={() => { setShowForm(false); load() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {seasons.length === 0 && !showForm ? (
        <div className="card p-6 text-center text-txt-muted text-xs">
          Aucune ligne de stats — <button onClick={() => setShowForm(true)} className="text-acc hover:underline">ajouter</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-bg-border">
                <th className="text-left px-2 py-2 text-[9px] text-txt-muted uppercase tracking-widest">Saison</th>
                <th className="text-left px-2 py-2 text-[9px] text-txt-muted uppercase tracking-widest">Ligue</th>
                <th className="text-left px-2 py-2 text-[9px] text-txt-muted uppercase tracking-widest">Équipe</th>
                {STAT_COLS.map(c => (
                  <th key={c.key} className="text-center px-2 py-2 text-[9px] text-txt-muted uppercase tracking-widest">{c.label}</th>
                ))}
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s, i) => (
                <tr key={s.id} className={`border-b border-bg-border/40 hover:bg-bg-hover/50 transition-colors ${i === 0 ? 'bg-bg-hover/20' : ''}`}>
                  <td className="px-2 py-1.5">
                    <span className="mono text-xs font-semibold text-txt-primary">{s.season}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="text-xs font-medium" style={{ color: LEAGUE_COLOR[s.league] || '#888' }}>
                      {s.league}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="text-xs text-txt-secondary">{s.team || '—'}</span>
                  </td>
                  {STAT_COLS.map(col => (
                    <EditableCell
                      key={col.key}
                      value={s[col.key]}
                      col={col}
                      onSave={(key, val) => handleStatSave(s.id, key, val)}
                    />
                  ))}
                  <td className="px-2 py-1.5">
                    <button onClick={() => handleDelete(s.id)}
                      className="text-txt-muted hover:text-red text-xs transition-colors">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
