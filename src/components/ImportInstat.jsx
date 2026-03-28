import { useState } from 'react'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

// Mapping colonnes InStat → schéma ProspectIQ
function parseInstatExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null })

  if (!raw.length) throw new Error('Fichier vide')

  // Remplacer '-' par null, convertir en nombre
  const toNum = (v) => {
    if (v === null || v === '-' || v === '') return null
    const n = parseFloat(String(v).replace('%', '').replace(',', '.'))
    return isNaN(n) ? null : n
  }

  // Parser les minutes "MM:SS" → décimal
  const toMin = (v) => {
    if (!v) return null
    const parts = String(v).split(':')
    if (parts.length !== 2) return null
    return Math.round((parseInt(parts[0]) + parseInt(parts[1]) / 60) * 10) / 10
  }

  // Moyenne sur toutes les lignes (ignorer null)
  const avg = (key) => {
    const vals = raw.map(r => toNum(r[key])).filter(v => v !== null)
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const avgMin = () => {
    const vals = raw.map(r => toMin(r['Minutes'])).filter(v => v !== null)
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const gp = raw.length

  // FG% calculé depuis makes/attempts
  const fgm  = avg('Field goals made')
  const fga  = avg('Field goals attempted')
  const fg3m = avg('3-pt field goals made')
  const fg3a = avg('3-pt field goals attempted')
  const ftm  = avg('Free throws made')
  const fta  = avg('Free throws attempted')

  const fg_pct  = (fgm && fga)  ? Math.round(fgm  / fga  * 1000) / 10 : null
  const fg3_pct = (fg3m && fg3a && fg3a > 0) ? Math.round(fg3m / fg3a * 1000) / 10 : null
  const ft_pct  = (ftm && fta)  ? Math.round(ftm  / fta  * 1000) / 10 : null

  // TS% = PTS / (2 * (FGA + 0.44 * FTA))
  const pts = avg('Points')
  const ts_pct = (pts && fga && fta)
    ? Math.round(pts / (2 * (fga + 0.44 * fta)) * 1000) / 10
    : null

  // eFG% = (FGM + 0.5 * FG3M) / FGA
  const efg_pct = (fgm && fg3m !== null && fga)
    ? Math.round((fgm + 0.5 * (fg3m || 0)) / fga * 1000) / 10
    : null

  const stats = {
    // Stats de base
    gp,
    min:       avgMin(),
    pts,
    reb:       avg('Rebounds'),
    ast:       avg('Assists'),
    stl:       avg('Steals'),
    blk:       avg('Blocks'),
    tov:       avg('Turnovers'),
    fgm, fga, fg_pct,
    fg3m, fg3a, fg3_pct,
    ftm, fta, ft_pct,
    oreb_pct:  avg('Offensive rebounds'),
    dreb_pct:  avg('Defensive rebounds'),
    plus_minus: avg('Plus/Minus'),

    // Stats avancées
    ortg:      avg('Offensive rating'),
    drtg:      avg('Defensive rating'),
    net_rtg:   avg('Net rating'),
    usg_pct:   avg('Usage Percentage'),
    ts_pct,
    efg_pct,

    // Stats InStat exclusives
    instat_pnr_handler: avg('PnR Handlers made'),
    instat_isolation:   avg('Isolations made'),
    instat_cuts:        avg('Cuts made'),
    instat_drives:      avg('Drives made'),
    instat_catch_shoot: avg('Catch and shoot made'),
    instat_post_up:     avg('Posts up made'),
    instat_screen_off:  avg('Screens off made'),
    instat_deflections: avg('Deflections'),
    instat_draw_foul:   avg('Draw foul rate'),
  }

  // Nettoyer les null
  return Object.fromEntries(Object.entries(stats).filter(([, v]) => v !== null))
}

export default function ImportInstat({ onImport, onClose }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [preview, setPreview]   = useState(null)
  const [error, setError]       = useState('')

  async function processFile(file) {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const buffer = await file.arrayBuffer()
      const stats = parseInstatExcel(buffer)
      setPreview(stats)
    } catch (e) {
      setError('Erreur de lecture : ' + e.message)
    }
    setLoading(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  function handleImport() {
    if (preview) {
      onImport(preview)
      onClose()
    }
  }

  const KEY_STATS = ['gp', 'min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fg_pct', 'fg3_pct', 'ft_pct', 'ts_pct', 'efg_pct', 'usg_pct', 'ortg', 'drtg', 'net_rtg', 'plus_minus']
  const INSTAT_STATS = ['instat_pnr_handler', 'instat_isolation', 'instat_cuts', 'instat_drives', 'instat_catch_shoot', 'instat_post_up', 'instat_deflections']
  const LABELS = {
    gp: 'Matchs', min: 'Min', pts: 'PTS', reb: 'REB', ast: 'AST',
    stl: 'STL', blk: 'BLK', tov: 'TOV', fg_pct: 'FG%', fg3_pct: '3P%',
    ft_pct: 'FT%', ts_pct: 'TS%', efg_pct: 'eFG%', usg_pct: 'USG%',
    ortg: 'ORTG', drtg: 'DRTG', net_rtg: 'Net', plus_minus: '+/-',
    instat_pnr_handler: 'PnR Handler', instat_isolation: 'Isolation',
    instat_cuts: 'Cuts', instat_drives: 'Drives',
    instat_catch_shoot: 'Catch & Shoot', instat_post_up: 'Post Up',
    instat_deflections: 'Deflections',
  }

  return (
    <div className="card p-5 border-blue-border bg-blue-dim/10 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-blue-light uppercase tracking-widest">📊 Importer depuis InStat</div>
          <div className="text-xs text-txt-muted mt-1">Exporte le fichier Excel depuis basketball.instatscout.com → Games</div>
        </div>
        <button onClick={onClose} className="text-txt-muted hover:text-txt-primary text-lg">✕</button>
      </div>

      {/* Zone de drop */}
      {!preview && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragging ? 'border-blue-light bg-blue-dim/20' : 'border-bg-border'
          }`}
        >
          <div className="text-2xl mb-2">📁</div>
          <p className="text-sm text-txt-secondary mb-3">Glisse le fichier Excel InStat ici</p>
          <p className="text-xs text-txt-muted mb-4">ou</p>
          <label className="btn-ghost text-xs cursor-pointer">
            Sélectionner le fichier
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
        </div>
      )}

      {loading && (
        <div className="text-center text-txt-muted text-sm animate-pulse py-4">
          Analyse du fichier InStat...
        </div>
      )}

      {error && (
        <div className="text-red-light text-xs bg-red-dim border border-red-light/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Aperçu des stats */}
      {preview && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-teal-light uppercase tracking-widest">
              ✅ {preview.gp} matchs analysés
            </div>
            <button
              onClick={() => setPreview(null)}
              className="text-xs text-txt-muted hover:text-txt-primary"
            >
              Changer de fichier
            </button>
          </div>

          {/* Stats de base */}
          <div>
            <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-2">Stats moyennes</div>
            <div className="grid grid-cols-6 gap-1.5">
              {KEY_STATS.filter(k => preview[k] != null).map(k => (
                <div key={k} className="bg-bg-card border border-bg-border rounded p-2 text-center">
                  <div className="text-[9px] text-txt-muted uppercase">{LABELS[k]}</div>
                  <div className="text-xs font-mono font-semibold text-txt-primary mt-0.5">{preview[k]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats InStat exclusives */}
          <div>
            <div className="text-[10px] text-blue-light uppercase tracking-widest mb-2">Stats InStat exclusives</div>
            <div className="grid grid-cols-4 gap-1.5">
              {INSTAT_STATS.filter(k => preview[k] != null).map(k => (
                <div key={k} className="bg-blue-dim/20 border border-blue-border rounded p-2 text-center">
                  <div className="text-[9px] text-blue-light uppercase">{LABELS[k]}</div>
                  <div className="text-xs font-mono font-semibold text-txt-primary mt-0.5">{preview[k]}</div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleImport} className="btn-primary text-xs">
            ✅ Importer ces stats dans la fiche
          </button>
        </div>
      )}
    </div>
  )
}
