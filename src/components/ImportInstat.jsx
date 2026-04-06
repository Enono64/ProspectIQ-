import { useState } from 'react'

async function loadXLSX() {
  if (window.XLSX) return window.XLSX
  await new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })
  return window.XLSX
}

function parseInstatExcel(XLSX, arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null })
  if (!raw.length) throw new Error('Fichier vide')

  // Parser une valeur — gère "55.3%", "55.3", "-", null
  const toNum = (v) => {
    if (v === null || v === '-' || v === '') return null
    const n = parseFloat(String(v).replace('%', '').replace(',', '.'))
    return isNaN(n) ? null : n
  }

  const toMin = (v) => {
    if (!v) return null
    const parts = String(v).split(':')
    if (parts.length !== 2) return null
    return Math.round((parseInt(parts[0]) + parseInt(parts[1]) / 60) * 10) / 10
  }

  // La dernière ligne du fichier InStat est toujours "Average per game"
  // On l'utilise directement pour les stats de base et les %
  const avgRow = raw[raw.length - 1]
  
  // Pour les stats comptables (pts, reb...) : utiliser la ligne Average directement
  const avg = (key) => {
    // Essayer d'abord la ligne Average (dernière ligne)
    const avgVal = toNum(avgRow?.[key])
    if (avgVal !== null) return avgVal
    // Fallback : moyenne manuelle
    const vals = raw.slice(0, -1).map(r => toNum(r[key])).filter(v => v !== null)
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }
  
  // Pour les % : calculer made/attempted sur toute la saison (plus précis)
  const avgPct = (madeKey, attKey) => {
    const made = raw.slice(0, -1).reduce((s, r) => s + (toNum(r[madeKey]) || 0), 0)
    const att  = raw.slice(0, -1).reduce((s, r) => s + (toNum(r[attKey])  || 0), 0)
    if (!att) return null
    return Math.round(made / att * 1000) / 10
  }

  const avgMin = () => {
    const vals = raw.map(r => toMin(r['Minutes'])).filter(v => v !== null)
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const gp = raw.length

  // Stats de base
  const fgm  = avg('Field goals made')
  const fga  = avg('Field goals attempted')
  const fg3m = avg('3-pt field goals made')
  const fg3a = avg('3-pt field goals attempted')
  const ftm  = avg('Free throws made')
  const fta  = avg('Free throws attempted')
  const pts  = avg('Points')

  // Calculer les % sur la saison entière (made/attempted) — plus précis que la moyenne des %
  const fg_pct  = avgPct('Field goals made',       'Field goals attempted')
  const fg3_pct = avgPct('3-pt field goals made',  '3-pt field goals attempted')
  const ft_pct  = avgPct('Free throws made',        'Free throws attempted')
  const usg_pct = avg('Usage Percentage')
  const efg_pct = avg('Effective field goal percentage')
  const ts_pct  = avg('True shooting percentage')

  const stats = {
    // Stats de base
    gp, min: avgMin(), pts,
    reb:  avg('Rebounds'),
    ast:  avg('Assists'),
    stl:  avg('Steals'),
    blk:  avg('Blocks'),
    tov:  avg('Turnovers'),
    fgm, fga, fg_pct,
    fg3m, fg3a, fg3_pct,
    ftm, fta, ft_pct,
    plus_minus: avg('Plus/Minus'),

    // Stats avancées directement depuis InStat
    ortg:    avg('Offensive rating'),
    drtg:    avg('Defensive rating'),
    net_rtg: avg('Net rating'),
    usg_pct,
    ts_pct,
    efg_pct,

    // Stats InStat exclusives
    is_pts_per_poss:       avg("Points per player's possession"),
    is_fg2m:               avg('2-pt field goals made'),
    is_fg2a:               avg('2-pt field goals attempted'),
    is_fouls:              avg('Fouls'),
    is_fouls_drawn:        avg('Fouls drawn'),
    is_screen_assist:      avg('Screen Assist'),
    is_possessions:        avg("Number of player's possessions"),
    is_pts_off_ast:        avg('Points off assists'),
    is_pts_off_screen_ast: avg('Points off screen assists'),
    is_deflections:        avg('Deflections'),
    is_trans_made:         avg('Transitions made'),
    is_trans_att:          avg('Transitions attempted'),
    is_catch_shoot_made:   avg('Catch and shoot made'),
    is_catch_shoot_att:    avg('Catch and shoot attempted'),
    is_catch_drive_made:   avg('Catch and drive made'),
    is_catch_drive_att:    avg('Catch and drive attempted'),
    is_screen_off_made:    avg('Screens off made'),
    is_screen_off_att:     avg('Screens off attempted'),
    is_post_made:          avg('Posts up made'),
    is_post_att:           avg('Posts up attempted'),
    is_iso_made:           avg('Isolations made'),
    is_iso_att:            avg('Isolations attempted'),
    is_handoff_made:       avg('Hand off made'),
    is_handoff_att:        avg('Hand off attempted'),
    is_cuts_made:          avg('Cuts made'),
    is_cuts_att:           avg('Cuts attempted'),
    is_pnr_handler_made:   avg('PnR Handlers made'),
    is_pnr_handler_att:    avg('PnR Handlers attempted'),
    is_pnr_roller_made:    avg('PnR Rollers made'),
    is_pnr_roller_att:     avg('PnR Rollers attempted'),
    is_pnp_made:           avg('PnP made'),
    is_pnp_att:            avg('PnP attempted'),
    is_uncontested_made:   avg('Uncontested field goals made'),
    is_uncontested_att:    avg('Uncontested field goals'),
    is_contested_made:     avg('Contested field goals made'),
    is_contested_att:      avg('Contested field goals'),
    is_team_pts:           avg('Team points with player'),
    is_opp_poss:           avg('Opponent possessions played'),
    is_opp_pts:            avg("Opponent's points with player"),
    is_ast_to:             avg('Assists to turnovers'),
    is_stl_to:             avg('Steals to turnovers'),
    is_draw_foul_rate:     avg('Draw foul rate'),
    is_opp_trans_made:     avg('Opp Transition shots made'),
    is_opp_trans_att:      avg('Opp Transition shots'),
    is_opp_catch_shoot_made: avg('Opp catch and shoot shots made'),
    is_opp_catch_shoot_att:  avg('Opp catch and shoot shots'),
    is_opp_catch_drive_made: avg('Opp catch and drive shots made'),
    is_opp_catch_drive_att:  avg('Opp Catch and drive shots'),
    is_opp_screen_off_made:  avg('Opp Screens off shots made'),
    is_opp_screen_off_att:   avg('Opp Screens off shots'),
    is_opp_post_made:      avg('Opp Post up shots made'),
    is_opp_post_att:       avg('Opp Post up shots'),
    is_opp_iso_made:       avg('Opp Isolations shots made'),
    is_opp_iso_att:        avg('Opp Isolations shots'),
    is_opp_handoff_made:   avg('Opp Hand off shots made'),
    is_opp_handoff_att:    avg('Opp Hand off shots'),
    is_opp_cuts_made:      avg('Opp Cuts shots made'),
    is_opp_cuts_att:       avg('Opp Cuts shots'),
    is_opp_pnr_made:       avg('Opp Pick-n-roll shots made'),
    is_opp_pnr_att:        avg('Opp Pick-n-roll shots'),
    is_opp_pnp_made:       avg('Opp Pick-n-Pop shots made'),
    is_opp_pnp_att:        avg('Opp Pick-n-Pop shots'),
    is_drives_made:        avg('Drives made'),
    is_drives_att:         avg('Drives with shot'),
    is_drives_right_made:  avg('Right drives made'),
    is_drives_right_att:   avg('Right drives'),
    is_drives_left_made:   avg('Left drives made'),
    is_drives_left_att:    avg('Left drives'),
    is_opp_drives_made:    avg('Opp Drives shots made'),
    is_opp_drives_att:     avg('Opp Drives shots'),
  }

  return Object.fromEntries(Object.entries(stats).filter(([, v]) => v !== null))
}

const BASE_STATS = [
  ['gp','Matchs'],['min','Min'],['pts','PTS'],['reb','REB'],['ast','AST'],
  ['stl','STL'],['blk','BLK'],['tov','TOV'],['fg_pct','FG%'],['fg3_pct','3P%'],
  ['ft_pct','FT%'],['ts_pct','TS%'],['efg_pct','eFG%'],['usg_pct','USG%'],
  ['ortg','ORTG'],['drtg','DRTG'],['net_rtg','Net'],['plus_minus','+/-'],
]

const INSTAT_GROUPS = [
  { label: 'Offensif', color: 'text-acc', border: 'border-acc/20', bg: 'bg-acc/5', keys: [
    ['is_pts_per_poss','Pts/Poss'],['is_possessions','Poss'],['is_pts_off_ast','Pts off AST'],
    ['is_pts_off_screen_ast','Pts off Screen'],['is_trans_made','Transition'],
    ['is_catch_shoot_made','Catch&Shoot'],['is_catch_drive_made','Catch&Drive'],
    ['is_deflections','Déflexions'],['is_draw_foul_rate','Draw Foul'],
  ]},
  { label: 'Création', color: 'text-purple', border: 'border-purple/20', bg: 'bg-purple/5', keys: [
    ['is_iso_made','Isolation'],['is_pnr_handler_made','PnR Handler'],
    ['is_pnr_roller_made','PnR Roller'],['is_pnp_made','PnP'],
    ['is_post_made','Post Up'],['is_handoff_made','Hand Off'],
    ['is_cuts_made','Cuts'],['is_screen_off_made','Screen Off'],
    ['is_drives_made','Drives'],['is_drives_right_made','Drive Droit'],
    ['is_drives_left_made','Drive Gauche'],
  ]},
  { label: 'Tirs', color: 'text-teal', border: 'border-teal/20', bg: 'bg-teal/5', keys: [
    ['is_uncontested_made','Non contestés'],['is_contested_made','Contestés'],
    ['is_fouls_drawn','Fautes subies'],['is_fouls','Fautes commises'],
    ['is_ast_to','AST/TO'],['is_stl_to','STL/TO'],
  ]},
  { label: 'Défense adverse', color: 'text-red', border: 'border-red/20', bg: 'bg-red/5', keys: [
    ['is_opp_trans_made','Opp Trans'],['is_opp_catch_shoot_made','Opp C&S'],
    ['is_opp_iso_made','Opp Iso'],['is_opp_pnr_made','Opp PnR'],
    ['is_opp_post_made','Opp Post'],['is_opp_drives_made','Opp Drives'],
  ]},
]

export default function ImportInstat({ onImport, onClose }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [preview, setPreview]   = useState(null)
  const [error, setError]       = useState('')

  async function processFile(file) {
    if (!file) return
    setLoading(true); setError('')
    try {
      const XLSX = await loadXLSX()
      const stats = parseInstatExcel(XLSX, await file.arrayBuffer())
      setPreview({ stats, file })
    } catch (e) { setError('Erreur : ' + e.message) }
    setLoading(false)
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  return (
    <div className="card p-5 flex flex-col gap-4" style={{ borderColor: '#4488ff30', background: '#4488ff05' }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-blue uppercase tracking-widest">📊 Importer depuis InStat / Hudl</div>
          <div className="text-xs text-txt-muted mt-1">Exporte depuis basketball.instatscout.com → Games → Excel</div>
        </div>
        <button onClick={onClose} className="text-txt-muted hover:text-txt-primary text-lg">✕</button>
      </div>

      {!preview && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragging ? 'border-blue bg-blue/5' : 'border-bg-border'}`}
        >
          <div className="text-3xl mb-3">📁</div>
          <p className="text-sm text-txt-secondary mb-3">Glisse le fichier Excel InStat ici</p>
          <label className="btn-ghost text-xs cursor-pointer">
            Sélectionner le fichier
            <input type="file" accept=".xlsx,.xls" onChange={e => processFile(e.target.files[0])} className="hidden" />
          </label>
        </div>
      )}

      {loading && <div className="text-center text-txt-muted text-sm animate-pulse py-4">Analyse InStat...</div>}
      {error && <div className="text-red text-xs bg-red/5 border border-red/20 rounded-md px-3 py-2">{error}</div>}

      {preview && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-teal uppercase tracking-widest">✅ {preview.stats?.gp} matchs analysés · 📁 {preview.file?.name}</div>
            <button onClick={() => setPreview(null)} className="text-xs text-txt-muted hover:text-txt-primary">Changer</button>
          </div>

          {/* Stats de base */}
          <div>
            <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-2">Stats moyennes</div>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
              {BASE_STATS.filter(([k]) => preview.stats?.[k] != null).map(([k, label]) => (
                <div key={k} className="bg-bg-card border border-bg-border rounded p-2 text-center">
                  <div className="text-[9px] text-txt-muted uppercase">{label}</div>
                  <div className="text-xs mono font-semibold text-txt-primary mt-0.5">{preview.stats?.[k]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Groupes InStat */}
          {INSTAT_GROUPS.map(group => {
            const available = group.keys.filter(([k]) => preview.stats?.[k] != null)
            if (!available.length) return null
            return (
              <div key={group.label}>
                <div className={`text-[10px] uppercase tracking-widest mb-2 ${group.color}`}>
                  Stats InStat — {group.label}
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {available.map(([k, label]) => (
                    <div key={k} className={`rounded p-2 text-center border ${group.border} ${group.bg}`}>
                      <div className={`text-[9px] uppercase ${group.color}`}>{label}</div>
                      <div className="text-xs mono font-semibold text-txt-primary mt-0.5">{preview.stats?.[k]}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <button onClick={async () => {
              try {
                await onImport(preview.stats, preview.file)
              } catch(e) {
                alert('❌ ' + e.message)
              }
            }} className="btn-primary text-xs">
            ✅ Importer dans la fiche
          </button>
        </div>
      )}
    </div>
  )
}
