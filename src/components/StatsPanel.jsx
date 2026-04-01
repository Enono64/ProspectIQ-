import { getPercentile, getStatContext, detectProfile, getVolumeEfficiencyQuadrant, computeAdvancedStats } from '../lib/statsContext'
import { fmt } from '../lib/utils'

// Barre de percentile
function PercentileBar({ value, stat, position, league, label, highlight = false }) {
  const ctx = getStatContext(value, stat, position, league)
  if (value == null) return (
    <div className="flex items-center justify-between py-1.5 border-b border-bg-border/40 last:border-0">
      <span className="text-[10px] text-txt-muted uppercase tracking-wider">{label}</span>
      <span className="mono text-xs text-txt-muted">—</span>
    </div>
  )

  const pct = ctx?.pct || 50

  return (
    <div className="py-2 border-b border-bg-border/40 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] uppercase tracking-wider ${highlight ? 'text-txt-primary font-semibold' : 'text-txt-muted'}`}>{label}</span>
        <div className="flex items-center gap-2">
          {ctx && <span className={`text-[9px] ${ctx.color}`}>{ctx.label}</span>}
          <span className={`mono text-sm font-semibold ${highlight ? 'text-txt-primary' : 'text-txt-secondary'}`}>{fmt(value)}</span>
        </div>
      </div>
      <div className="h-1 bg-bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 75 ? '#00c896' : pct >= 50 ? '#4488ff' : pct >= 25 ? '#ffaa00' : '#ff4466'
          }}
        />
      </div>
    </div>
  )
}

// Graphique Volume vs Efficacité
function VolumeEfficiencyChart({ usg, ts }) {
  const quad = getVolumeEfficiencyQuadrant(usg, ts)
  if (!usg || !ts) return null

  const x = Math.min(95, Math.max(5, ((usg - 12) / (35 - 12)) * 90 + 5))
  const y = Math.min(95, Math.max(5, 100 - ((ts - 45) / (70 - 45)) * 90 - 5))

  return (
    <div className="card-sm p-3">
      <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-2">Volume vs Efficacité</div>
      <div className="relative bg-bg rounded-lg overflow-hidden" style={{ height: 140 }}>
        {/* Quadrants */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          <div className="border-b border-r border-bg-border/30 flex items-center justify-center">
            <span className="text-[8px] text-txt-muted/50">Efficient</span>
          </div>
          <div className="border-b border-bg-border/30 flex items-center justify-center" style={{ background: '#00c89608' }}>
            <span className="text-[8px] text-teal/50">⭐ Efficient High</span>
          </div>
          <div className="border-r border-bg-border/30 flex items-center justify-center">
            <span className="text-[8px] text-txt-muted/50">Low Usage</span>
          </div>
          <div className="flex items-center justify-center" style={{ background: '#ffaa0008' }}>
            <span className="text-[8px] text-amber/50">Volume</span>
          </div>
        </div>

        {/* Axes labels */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-txt-muted">USG% →</div>
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-txt-muted" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateY(50%)' }}>TS% →</div>

        {/* Lignes médianes */}
        <div className="absolute inset-0">
          <div className="absolute border-b border-bg-border2/50" style={{ top: '50%', left: '10%', right: '5%' }} />
          <div className="absolute border-r border-bg-border2/50" style={{ left: '50%', top: '5%', bottom: '10%' }} />
        </div>

        {/* Point joueur */}
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white/80 transition-all duration-500"
          style={{
            left: `${x}%`,
            top:  `${y}%`,
            transform: 'translate(-50%, -50%)',
            background: quad?.color || '#888',
            boxShadow: `0 0 8px ${quad?.color || '#888'}60`
          }}
        />
      </div>
      {quad && (
        <div className="mt-2">
          <span className="text-[10px] font-semibold" style={{ color: quad.color }}>{quad.label}</span>
          <p className="text-[10px] text-txt-muted mt-0.5">{quad.desc}</p>
        </div>
      )}
    </div>
  )
}

export default function StatsPanel({ player }) {
  if (!player) return null

  const computed = computeAdvancedStats(player)
  const p = { ...player, ...computed }
  const pos = player.position?.split('/')?.[0] || 'SF'
  const profile = detectProfile(p)

  return (
    <div className="flex flex-col gap-4">

      {/* Profil détecté */}
      <div className="card-sm p-3 flex items-center gap-3">
        <span className="text-2xl">{profile.icon}</span>
        <div>
          <div className={`text-sm font-bold ${profile.color}`}>{profile.label}</div>
          <div className="text-[10px] text-txt-muted mt-0.5">Profil détecté automatiquement depuis les stats</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Stats de base contextualisées */}
        <div className="card-sm p-4">
          <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Scoring & création</div>
          <PercentileBar value={p.pts}    stat="pts"    position={pos} league={p.league} label="PTS" highlight />
          <PercentileBar value={p.ast}    stat="ast"    position={pos} league={p.league} label="AST" highlight />
          <PercentileBar value={p.reb}    stat="reb"    position={pos} league={p.league} label="REB" />
          <PercentileBar value={p.stl}    stat="stl"    position={pos} league={p.league} label="STL" />
          <PercentileBar value={p.blk}    stat="blk"    position={pos} league={p.league} label="BLK" />
        </div>

        {/* Efficacité */}
        <div className="card-sm p-4">
          <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Efficacité</div>
          <PercentileBar value={p.ts_pct}  stat="ts_pct"  position={pos} league={p.league} label="TS%" highlight />
          {/* FG% avec made/attempted */}
          <div className="flex items-center justify-between py-1.5 border-b border-bg-border/30">
            <span className="text-[10px] text-txt-muted uppercase tracking-wider">FG%</span>
            <div className="flex items-center gap-2">
              {p.fgm != null && p.fga != null && <span className="text-[10px] text-txt-muted mono">{p.fgm}/{p.fga}</span>}
              <span className="mono text-sm font-semibold text-txt-secondary">{p.fg_pct != null ? p.fg_pct + '%' : '—'}</span>
            </div>
          </div>
          {/* 3P% avec made/attempted */}
          <div className="flex items-center justify-between py-1.5 border-b border-bg-border/30">
            <span className="text-[10px] text-txt-muted uppercase tracking-wider">3P%</span>
            <div className="flex items-center gap-2">
              {p.fg3m != null && p.fg3a != null && <span className="text-[10px] text-txt-muted mono">{p.fg3m}/{p.fg3a}</span>}
              <span className={`mono text-sm font-semibold ${p.fg3_pct == null ? 'text-txt-muted' : p.fg3_pct >= 37 ? 'text-teal' : p.fg3_pct < 30 ? 'text-red' : 'text-txt-secondary'}`}>{p.fg3_pct != null ? p.fg3_pct + '%' : '—'}</span>
            </div>
          </div>
          {/* FT% avec made/attempted */}
          <div className="flex items-center justify-between py-1.5 border-b border-bg-border/30">
            <span className="text-[10px] text-txt-muted uppercase tracking-wider">FT%</span>
            <div className="flex items-center gap-2">
              {p.ftm != null && p.fta != null && <span className="text-[10px] text-txt-muted mono">{p.ftm}/{p.fta}</span>}
              <span className="mono text-sm font-semibold text-txt-secondary">{p.ft_pct != null ? p.ft_pct + '%' : '—'}</span>
            </div>
          </div>
          <PercentileBar value={p.usg_pct} stat="usg_pct" position={pos} league={p.league} label="USG%" />
        </div>

        {/* Impact */}
        <div className="card-sm p-4">
          <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Impact</div>
          <PercentileBar value={p.bpm}       stat="bpm"    position={pos} league={p.league} label="BPM" highlight />
          <PercentileBar value={p.vorp}      stat="bpm"    position={pos} league={p.league} label="VORP" />
          <PercentileBar value={p.per}       stat="pts"    position={pos} league={p.league} label="PER" />
          <PercentileBar value={p.net_rtg != null ? p.net_rtg : computed.net_rtg} stat="bpm" position={pos} league={p.league} label="Net Rtg" />
          <PercentileBar value={p.ast_to != null ? p.ast_to : computed.ast_to}   stat="ast"  position={pos} league={p.league} label="AST/TO" />
        </div>

        {/* Volume vs Efficacité */}
        <div className="flex flex-col gap-3">
          <VolumeEfficiencyChart usg={p.usg_pct} ts={p.ts_pct || computed.ts_pct} />

          {/* Stats InStat si dispo */}
          {(p.is_drives_made || p.is_iso_made || p.is_pnr_handler_made) && (
            <div className="card-sm p-3">
              <div className="text-[10px] text-blue uppercase tracking-widest mb-2">InStat — Mode de création</div>
              <div className="flex flex-col gap-1.5">
                {[
                  ['PnR Handler', p.is_pnr_handler_made],
                  ['Isolation', p.is_iso_made],
                  ['Drives', p.is_drives_made],
                  ['Cuts', p.is_cuts_made],
                  ['Catch & Shoot', p.is_catch_shoot_made],
                  ['Post Up', p.is_post_made],
                ].filter(([, v]) => v != null).map(([label, val]) => {
                  const max = Math.max(...[p.is_pnr_handler_made, p.is_iso_made, p.is_drives_made, p.is_cuts_made, p.is_catch_shoot_made, p.is_post_made].filter(v => v != null))
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-txt-secondary">{label}</span>
                        <span className="mono text-blue">{fmt(val)}/match</span>
                      </div>
                      <div className="h-1 bg-bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue/60 transition-all duration-500"
                          style={{ width: `${(val / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
