import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { getBadgeClass, gradeColor, fmt, fmtDate, LEAGUE_COLOR } from '../lib/utils'

function SectionLabel({ children }) {
  return (
    <div className="section-label mb-3">{children}</div>
  )
}

function AlertItem({ color, name, info, tag, tagClass }) {
  return (
    <div className="flex items-center gap-3 p-2.5 bg-bg-hover rounded-lg border border-bg-border">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-txt-primary truncate">{name}</div>
        <div className="text-[10px] text-txt-muted mt-0.5 truncate">{info}</div>
      </div>
      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${tagClass}`}>{tag}</span>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    api.getDashboard().then(setData).finally(() => setLoading(false))
  }, [])

  const { totalPlayers = 0, statusCount = {}, leagueCount = {}, topPlayers = [], recentReports = [], lastSync } = data || {}
  const topProspects = (statusCount['⭐ TOP PROSPECT'] || 0) + (statusCount['🟢 PRIORITAIRE'] || 0)

  return (
    <div className="flex flex-col h-full">

      {/* Topbar */}
      <div className="h-[50px] bg-bg-surface border-b border-bg-border flex items-center px-5 gap-4 flex-shrink-0">
        <div>
          <div className="text-sm font-bold tracking-wider text-txt-primary">PROSPECTIQ</div>
          <div className="text-[10px] text-txt-muted capitalize">{today}</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {lastSync && (
            <div className="flex items-center gap-1.5 bg-teal/5 border border-teal/20 rounded-md px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
              <span className="text-[10px] text-teal font-medium">Sync active · {fmtDate(lastSync?.finished_at)}</span>
            </div>
          )}
          <Link to="/players/new" className="btn-primary text-xs py-1.5 px-3">+ Joueur</Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-txt-muted text-sm animate-pulse">Chargement...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">

            {/* Alertes */}
            <div className="col-span-2 card p-4">
              <SectionLabel>🔔 Alertes de la semaine</SectionLabel>
              <div className="flex flex-col gap-2">
                {topPlayers.slice(0, 2).map(p => (
                  <Link key={p.id} to={`/players/${p.id}`}>
                    <AlertItem
                      color="#ffaa00"
                      name={`${p.first_name} ${p.last_name}`}
                      info={`${p.team} · ${p.league} · Note ${p.scout_grade}/10`}
                      tag="À observer"
                      tagClass="bg-amber/10 text-amber border border-amber/20"
                    />
                  </Link>
                ))}
                {recentReports.slice(0, 1).map(r => (
                  <AlertItem
                    key={r.id}
                    color="#00c896"
                    name={`${r.players?.first_name} ${r.players?.last_name}`}
                    info={`Rapport ${r.source} disponible · ${fmtDate(r.report_date)}`}
                    tag="Rapport prêt"
                    tagClass="bg-teal/10 text-teal border border-teal/20"
                  />
                ))}
                {totalPlayers === 0 && (
                  <div className="text-txt-muted text-xs p-4 text-center">
                    Aucune alerte — <Link to="/players/new" className="text-acc hover:underline">ajouter des joueurs</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Matchs du jour */}
            <div className="card p-4">
              <SectionLabel>📅 Matchs aujourd'hui</SectionLabel>
              <div className="flex flex-col">
                {topPlayers.slice(0, 4).map((p, i) => (
                  <div key={p.id} className={`py-2 ${i < 3 ? 'border-b border-bg-border' : ''}`}>
                    <div className="text-xs font-semibold text-txt-primary">{p.team}</div>
                    <div className="text-[10px] text-txt-muted mt-0.5">{p.league}</div>
                    <div className="text-[10px] text-acc mt-0.5">
                      <Link to={`/players/${p.id}`} className="hover:underline">
                        👁 {p.first_name} {p.last_name}
                      </Link>
                    </div>
                  </div>
                ))}
                {topPlayers.length === 0 && (
                  <div className="text-txt-muted text-xs py-4 text-center">Aucun match — <Link to="/schedule" className="text-acc hover:underline">voir le calendrier</Link></div>
                )}
              </div>
            </div>

            {/* Activité récente */}
            <div className="card p-4">
              <SectionLabel>⚡ Activité récente</SectionLabel>
              <div className="flex flex-col gap-2">
                {recentReports.map(r => (
                  <div key={r.id} className="flex gap-2.5 py-2 border-b border-bg-border last:border-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border ${
                      r.source === 'IA'
                        ? 'bg-purple/10 border-purple/20'
                        : 'bg-acc/10 border-acc/20'
                    }`}>
                      {r.source === 'IA' ? '🤖' : '📋'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-txt-primary truncate">
                        Rapport {r.source} — {r.players?.first_name} {r.players?.last_name}
                      </div>
                      <div className="text-[10px] text-txt-muted mt-0.5">{fmtDate(r.report_date)}</div>
                    </div>
                  </div>
                ))}
                {recentReports.length === 0 && (
                  <div className="text-txt-muted text-xs py-4 text-center">Aucune activité récente</div>
                )}
              </div>
            </div>

            {/* Top prospects */}
            <div className="col-span-2 card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="section-label flex-1">🏆 Top prospects</div>
                <Link to="/players" className="text-[10px] text-acc hover:underline ml-3">Voir tout →</Link>
              </div>
              <div className="flex flex-col gap-1">
                {topPlayers.map((p, i) => (
                  <Link key={p.id} to={`/players/${p.id}`}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-bg-hover transition-colors group">
                    <span className={`mono text-xs w-4 text-center flex-shrink-0 ${i === 0 ? 'text-amber font-bold' : 'text-txt-muted'}`}>
                      {i + 1}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-bg-hover border border-bg-border2 flex items-center justify-center text-[9px] font-bold text-txt-muted flex-shrink-0">
                      {p.first_name?.[0]}{p.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-txt-primary truncate group-hover:text-acc transition-colors">
                        {p.first_name} {p.last_name}
                      </div>
                      <div className="text-[10px] text-txt-muted">
                        {p.position} · {p.team} · <span style={{ color: LEAGUE_COLOR[p.league] || '#888' }}>{p.league}</span>
                      </div>
                    </div>
                    <div className="mono text-xs text-txt-secondary flex-shrink-0 text-right">
                      <span className="text-teal">{fmt(p.pts)}</span> / {fmt(p.ast)}
                    </div>
                    <span className={`mono text-sm font-bold w-5 text-center flex-shrink-0 ${gradeColor(p.scout_grade)}`}>
                      {p.scout_grade}
                    </span>
                    <span className={getBadgeClass(p.status)}>{p.status}</span>
                  </Link>
                ))}
                {topPlayers.length === 0 && (
                  <div className="text-txt-muted text-xs py-6 text-center">
                    Aucun joueur — <Link to="/players/new" className="text-acc hover:underline">ajouter le premier</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Répartition ligues + statuts */}
            <div className="card p-4">
              <SectionLabel>📊 Répartition</SectionLabel>
              <div className="flex flex-col gap-2 mb-4">
                {Object.entries(leagueCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([league, count]) => {
                  const max = Math.max(...Object.values(leagueCount))
                  return (
                    <div key={league}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-txt-secondary">{league}</span>
                        <span className="mono" style={{ color: LEAGUE_COLOR[league] || '#888' }}>{count}</span>
                      </div>
                      <div className="h-1 bg-bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(count/max)*100}%`, background: LEAGUE_COLOR[league] || '#888' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  ['⭐ TOP PROSPECT','badge-top'],
                  ['🟢 PRIORITAIRE','badge-prio'],
                  ['🟡 À SURVEILLER','badge-watch'],
                  ['🔵 EN VEILLE','badge-veil'],
                  ['🔴 ÉCARTÉ','badge-out'],
                ].map(([s, cls]) => (
                  <div key={s} className="flex items-center justify-between">
                    <span className={cls}>{s}</span>
                    <span className="mono text-xs text-txt-muted">{statusCount[s] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
