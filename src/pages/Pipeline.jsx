import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { gradeColor, fmt, LEAGUE_COLOR } from '../lib/utils'

const COLUMNS = [
  { key: '⭐ TOP PROSPECT', label: 'Top Prospect', color: '#00c896', bg: 'bg-teal/5',   border: 'border-teal/20' },
  { key: '🟢 PRIORITAIRE',  label: 'Prioritaire',  color: '#44dd88', bg: 'bg-green/5',  border: 'border-green/20' },
  { key: '🟡 À SURVEILLER', label: 'À surveiller', color: '#ffaa00', bg: 'bg-amber/5',  border: 'border-amber/20' },
  { key: '🔵 EN VEILLE',    label: 'En veille',    color: '#4488ff', bg: 'bg-blue/5',   border: 'border-blue/20' },
  { key: '🔴 ÉCARTÉ',       label: 'Écarté',       color: '#ff4466', bg: 'bg-red/5',    border: 'border-red/20' },
]

function PlayerCard({ player, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, player)}
      className="bg-bg-card border border-bg-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-bg-border2 transition-all hover:shadow-lg group"
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-bg-hover border border-bg-border2 flex items-center justify-center text-[10px] font-bold text-txt-muted flex-shrink-0">
          {player.first_name?.[0]}{player.last_name?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <Link to={`/players/${player.id}`}
            className="text-xs font-semibold text-txt-primary hover:text-acc transition-colors truncate block">
            {player.first_name} {player.last_name}
          </Link>
          <div className="text-[10px] text-txt-muted truncate mt-0.5">
            {player.position} · {player.team}
          </div>
          <div className="text-[10px] font-medium mt-0.5" style={{ color: LEAGUE_COLOR[player.league] || '#888' }}>
            {player.league}
          </div>
        </div>
        <span className={`mono text-sm font-bold flex-shrink-0 ${gradeColor(player.scout_grade)}`}>
          {player.scout_grade}
        </span>
      </div>

      {/* Stats rapides */}
      {(player.pts || player.ast || player.reb) && (
        <div className="flex gap-3 mt-2 pt-2 border-t border-bg-border">
          {player.pts != null && <div className="text-center"><div className="mono text-xs text-teal font-semibold">{fmt(player.pts)}</div><div className="text-[8px] text-txt-muted">PTS</div></div>}
          {player.ast != null && <div className="text-center"><div className="mono text-xs text-txt-secondary">{fmt(player.ast)}</div><div className="text-[8px] text-txt-muted">AST</div></div>}
          {player.reb != null && <div className="text-center"><div className="mono text-xs text-txt-secondary">{fmt(player.reb)}</div><div className="text-[8px] text-txt-muted">REB</div></div>}
          {player.age  != null && <div className="text-center ml-auto"><div className="mono text-xs text-txt-muted">{player.age}</div><div className="text-[8px] text-txt-muted">ans</div></div>}
        </div>
      )}

      {/* Tags */}
      {player.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {player.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-purple/10 text-purple border border-purple/20">{tag}</span>
          ))}
        </div>
      )}

      {/* Contrat */}
      {player.contract_end && (
        <div className="mt-2 text-[9px] text-amber flex items-center gap-1">
          ⏰ Contrat → {player.contract_end}
        </div>
      )}
    </div>
  )
}

function Column({ col, players, onDrop, onDragOver, onDragStart }) {
  return (
    <div
      className={`flex flex-col rounded-xl border ${col.border} ${col.bg} min-h-[400px] w-64 flex-shrink-0`}
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, col.key)}
    >
      <div className="px-3 py-2.5 border-b border-bg-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
          <span className="text-xs font-semibold text-txt-primary">{col.label}</span>
        </div>
        <span className="mono text-xs text-txt-muted bg-bg-card border border-bg-border rounded px-1.5 py-0.5">
          {players.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-2 flex-1">
        {players.map(p => (
          <PlayerCard key={p.id} player={p} onDragStart={onDragStart} />
        ))}
        {players.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[10px] text-txt-muted border-2 border-dashed border-bg-border rounded-lg m-1">
            Glisser ici
          </div>
        )}
      </div>
    </div>
  )
}

export default function Pipeline() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(null)
  const [filter, setFilter]   = useState('')

  useEffect(() => {
    api.getPlayers().then(data => {
      // Parser les tags si string
      const parsed = (data || []).map(p => ({
        ...p,
        tags: typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : (p.tags || [])
      }))
      setPlayers(parsed)
    }).finally(() => setLoading(false))
  }, [])

  function handleDragStart(e, player) {
    setDragging(player)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e, newStatus) {
    e.preventDefault()
    if (!dragging || dragging.status === newStatus) { setDragging(null); return }
    setPlayers(prev => prev.map(p => p.id === dragging.id ? { ...p, status: newStatus } : p))
    await api.updatePlayer(dragging.id, { status: newStatus }).catch(console.error)
    setDragging(null)
  }

  const filtered = players.filter(p =>
    !filter || `${p.first_name} ${p.last_name} ${p.team} ${p.league}`.toLowerCase().includes(filter.toLowerCase())
  )

  const byStatus = (key) => filtered.filter(p => p.status === key)

  return (
    <div className="flex flex-col h-full">
      <div className="h-[50px] bg-bg-surface border-b border-bg-border flex items-center px-5 gap-4 flex-shrink-0">
        <div>
          <div className="text-sm font-bold tracking-wider text-txt-primary">Pipeline</div>
          <div className="text-[10px] text-txt-muted">{players.length} joueurs · glisser-déposer pour changer le statut</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input text-xs w-48 py-1.5"
            placeholder="🔍 Filtrer..."
          />
          <Link to="/players/new" className="btn-primary text-xs py-1.5 px-3">+ Joueur</Link>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-txt-muted text-sm animate-pulse">Chargement...</div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 h-full min-w-max">
            {COLUMNS.map(col => (
              <Column
                key={col.key}
                col={col}
                players={byStatus(col.key)}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
