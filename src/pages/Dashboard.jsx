import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { getBadgeClass, gradeColor, fmt, fmtDate, LEAGUE_COLOR } from '../lib/utils'

function KpiCard({ label, value, sub, color = 'orange' }) {
  const colors = {
    orange: 'bg-orange-dim border-orange-border text-orange',
    purple: 'bg-purple-dim border-purple-border text-purple-light',
    teal:   'bg-teal-dim border-teal-border text-teal-light',
    blue:   'bg-blue-dim border-blue-border text-blue-light',
  }
  return (
    <div className={`rounded-lg p-3 border ${colors[color]}`}>
      <div className="text-xs text-white/50 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-white/50 mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full p-20 text-txt-muted text-sm animate-pulse">
      Chargement du dashboard...
    </div>
  )

  const { totalPlayers = 0, statusCount = {}, leagueCount = {}, topPlayers = [], recentReports = [], lastSync } = data || {}

  const topProspects = (statusCount['⭐ TOP PROSPECT'] || 0) + (statusCount['🟢 PRIORITAIRE'] || 0)
  const ligues = Object.entries(leagueCount).sort((a, b) => b[1] - a[1])
  const maxLigue = Math.max(...ligues.map(([, v]) => v), 1)

  return (
    <div className="p-5 flex flex-col gap-5">

      {/* Topbar */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-base font-semibold text-txt-primary tracking-widest">SCOUTDEX</h1>
          <p className="text-xs text-txt-muted">Dashboard — vue d'ensemble</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {lastSync && (
            <span className="text-xs text-teal-light bg-teal-dim border border-teal-border px-2.5 py-1 rounded-md">
              ● Sync {fmtDate(lastSync.finished_at)}
            </span>
          )}
          <Link to="/players/new" className="btn-primary text-xs">
            + Ajouter un joueur
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Joueurs suivis"   value={totalPlayers} sub="base active"        color="orange" />
        <KpiCard label="Top prospects"    value={topProspects} sub="⭐ + 🟢 prioritaires" color="purple" />
        <KpiCard label="Rapports générés" value={recentReports.length > 0 ? '—' : '0'} sub="ce mois" color="teal" />
        <KpiCard label="Ligues couvertes" value={ligues.length} sub="NBA · Euro · NCAA"  color="blue"   />
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* Top joueurs */}
        <div className="col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
            <span className="text-xs text-txt-muted uppercase tracking-widest">Pipeline recrutement</span>
            <Link to="/players" className="text-xs text-orange hover:underline">Voir tout →</Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-bg-border">
                {['Joueur', 'Pos', 'Ligue', 'PTS', 'BPM', 'TS%', 'Note', 'Statut'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-txt-muted uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topPlayers.map(p => (
                <tr key={p.id} className="border-b border-bg-border/50 hover:bg-bg-card transition-colors">
                  <td className="px-4 py-2.5">
                    <Link to={`/players/${p.id}`} className="font-medium text-txt-primary hover:text-orange transition-colors">
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-dim text-purple-light">{p.position || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span style={{ color: LEAGUE_COLOR[p.league] || '#888' }} className="text-[11px]">
                      {p.league || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-txt-primary">{fmt(p.pts)}</td>
                  <td className={`px-4 py-2.5 font-mono ${p.bpm >= 0 ? 'text-teal-light' : 'text-red-light'}`}>
                    {p.bpm != null ? (p.bpm >= 0 ? '+' : '') + fmt(p.bpm) : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-txt-secondary">{fmt(p.ts_pct)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-bold text-sm ${gradeColor(p.scout_grade)}`}>{p.scout_grade}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={getBadgeClass(p.status)}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {topPlayers.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-txt-muted">Aucun joueur — <Link to="/players/new" className="text-orange hover:underline">ajouter le premier</Link></td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Colonne droite */}
        <div className="flex flex-col gap-4">

          {/* Répartition ligues */}
          <div className="card p-4">
            <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Ligues</div>
            <div className="flex flex-col gap-2.5">
              {ligues.map(([league, count]) => (
                <div key={league}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-txt-secondary">{league}</span>
                    <span style={{ color: LEAGUE_COLOR[league] || '#888' }} className="font-mono">{count}</span>
                  </div>
                  <div className="h-1 bg-bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(count / maxLigue) * 100}%`, background: LEAGUE_COLOR[league] || '#888' }}
                    />
                  </div>
                </div>
              ))}
              {ligues.length === 0 && <p className="text-txt-muted text-xs">Aucune donnée</p>}
            </div>
          </div>

          {/* Statuts */}
          <div className="card p-4">
            <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Statuts</div>
            <div className="flex flex-col gap-2">
              {[
                ['⭐ TOP PROSPECT', 'badge-top'],
                ['🟢 PRIORITAIRE',  'badge-prio'],
                ['🟡 À SURVEILLER', 'badge-watch'],
                ['🔵 EN VEILLE',    'badge-veil'],
                ['🔴 ÉCARTÉ',       'badge-out'],
              ].map(([status, cls]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className={cls}>{status}</span>
                  <span className="font-mono text-xs text-txt-secondary">{statusCount[status] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Derniers rapports */}
          <div className="card p-4">
            <div className="text-xs text-txt-muted uppercase tracking-widest mb-3">Rapports récents</div>
            <div className="flex flex-col gap-2">
              {recentReports.map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <div>
                    <div className="text-txt-secondary font-medium">
                      {r.players?.first_name} {r.players?.last_name}
                    </div>
                    <div className="text-txt-muted">{fmtDate(r.report_date)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={r.source === 'IA' ? 'text-purple-light text-[10px]' : 'text-teal-light text-[10px]'}>
                      {r.source}
                    </span>
                    <span className={`font-bold ${gradeColor(r.global_grade)}`}>{r.global_grade}</span>
                  </div>
                </div>
              ))}
              {recentReports.length === 0 && <p className="text-txt-muted text-xs">Aucun rapport</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
