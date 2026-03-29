// ============================================================
//  ProspectIQ — Contextualisation des stats avancées
//  Benchmarks par poste et par niveau de ligue
// ============================================================

// Moyennes de référence par poste (saison 2024-25 toutes ligues confondues)
const BENCHMARKS = {
  PG: { pts: 13.5, ast: 5.2, reb: 3.8, stl: 1.1, blk: 0.3, fg_pct: 44, fg3_pct: 35, ft_pct: 78, ts_pct: 54, usg_pct: 22, bpm: 0.2 },
  SG: { pts: 14.2, ast: 3.1, reb: 3.9, stl: 1.0, blk: 0.4, fg_pct: 45, fg3_pct: 36, ft_pct: 79, ts_pct: 55, usg_pct: 21, bpm: 0.0 },
  SF: { pts: 13.8, ast: 2.6, reb: 5.2, stl: 1.0, blk: 0.7, fg_pct: 46, fg3_pct: 35, ft_pct: 76, ts_pct: 55, usg_pct: 20, bpm: 0.1 },
  PF: { pts: 13.1, ast: 2.1, reb: 7.1, stl: 0.8, blk: 1.0, fg_pct: 49, fg3_pct: 33, ft_pct: 74, ts_pct: 56, usg_pct: 19, bpm: 0.2 },
  C:  { pts: 12.4, ast: 1.8, reb: 8.9, stl: 0.7, blk: 1.5, fg_pct: 55, fg3_pct: 28, ft_pct: 70, ts_pct: 58, usg_pct: 18, bpm: 0.3 },
}

// Facteur de niveau par ligue (1 = NBA, plus bas = niveau inférieur)
export const LEAGUE_LEVEL = {
  'NBA':              1.0,
  'EuroLeague':       0.82,
  'G-League':         0.75,
  'EuroCup':          0.72,
  'Liga ACB (ESP)':   0.74,
  'BBL (GER)':        0.68,
  'Lega A (ITA)':     0.68,
  'BCL':              0.65,
  'BSL (TUR)':        0.65,
  'Betclic Élite':    0.62,
  'Basket League (GRE)': 0.60,
  'BNXT League (BEL/NED)': 0.58,
  'Basketligan (SWE)': 0.55,
  'Korisliiga (FIN)': 0.52,
  'Pro B':            0.48,
  'NCAA':             0.58,
  'NM1':              0.38,
  'NBL (AUS)':        0.60,
  'CBA (CHN)':        0.55,
  'KBL (KOR)':        0.50,
}

// Obtenir le benchmark pour un poste
function getBenchmark(position) {
  const pos = position?.split('/')?.[0]?.trim()
  return BENCHMARKS[pos] || BENCHMARKS['SF']
}

// Calculer le percentile d'une stat (0-100)
// Pour les stats "plus c'est haut, mieux c'est"
export function getPercentile(value, stat, position) {
  if (value == null) return null
  const bench = getBenchmark(position)
  const ref = bench[stat]
  if (!ref) return null

  // Écart-type approximatif selon la stat
  const stdDevs = {
    pts: 5.5, ast: 2.2, reb: 2.8, stl: 0.4, blk: 0.5,
    fg_pct: 6, fg3_pct: 5, ft_pct: 8, ts_pct: 5, usg_pct: 6, bpm: 2.5,
  }
  const std = stdDevs[stat] || 3
  const z = (value - ref) / std

  // Conversion z-score → percentile (approximation)
  const percentile = Math.min(99, Math.max(1, Math.round(50 + z * 15)))
  return percentile
}

// Label contextuel
export function getStatContext(value, stat, position, league) {
  if (value == null) return null
  const pct = getPercentile(value, stat, position)
  if (pct == null) return null

  const leagueLevel = LEAGUE_LEVEL[league] || 0.6
  const leagueName = league || 'sa ligue'

  if (pct >= 90) return { label: `Top 10% des ${position || 'joueurs'} · ${leagueName}`, color: 'text-teal', pct }
  if (pct >= 75) return { label: `Top 25% · ${leagueName}`, color: 'text-green', pct }
  if (pct >= 50) return { label: `Au-dessus de la moyenne · ${leagueName}`, color: 'text-txt-secondary', pct }
  if (pct >= 25) return { label: `En-dessous de la moyenne · ${leagueName}`, color: 'text-amber', pct }
  return { label: `Bas du classement · ${leagueName}`, color: 'text-red', pct }
}

// Calculer toutes les stats avancées depuis les stats de base
export function computeAdvancedStats(p) {
  const s = {}

  // TS% = PTS / (2 * (FGA + 0.44 * FTA))
  if (p.pts && p.fga && p.fta)
    s.ts_pct = +( p.pts / (2 * (p.fga + 0.44 * p.fta)) * 100).toFixed(1)

  // eFG% = (FGM + 0.5 * FG3M) / FGA
  if (p.fgm != null && p.fg3m != null && p.fga)
    s.efg_pct = +((p.fgm + 0.5 * p.fg3m) / p.fga * 100).toFixed(1)

  // Net Rating
  if (p.ortg && p.drtg)
    s.net_rtg = +(p.ortg - p.drtg).toFixed(1)

  // AST/TO
  if (p.ast && p.tov && p.tov > 0)
    s.ast_to = +(p.ast / p.tov).toFixed(2)

  // 2P%
  if (p.fgm != null && p.fg3m != null && p.fga && p.fg3a != null)
    s.fg2_pct = +((p.fgm - p.fg3m) / Math.max(p.fga - p.fg3a, 1) * 100).toFixed(1)

  return s
}

// Profil offensif détecté
export function detectProfile(p) {
  const pts = p.pts || 0
  const ast = p.ast || 0
  const reb = p.reb || 0
  const usg = p.usg_pct || 0
  const ts  = p.ts_pct  || 0
  const bpm = p.bpm     || 0
  const stl = p.stl     || 0
  const blk = p.blk     || 0

  if (usg > 28 && pts > 20)              return { label: 'Primary Scorer', color: 'text-acc', icon: '🔥' }
  if (ast > 7  && usg > 22)              return { label: 'Playmaker', color: 'text-purple', icon: '🎯' }
  if (usg > 23 && ast > 4 && pts > 14)  return { label: 'Shot Creator', color: 'text-blue', icon: '⚡' }
  if (ts > 60  && usg < 18 && pts > 10) return { label: '3&D Specialist', color: 'text-teal', icon: '🎯' }
  if (reb > 10 && blk > 1.5)            return { label: 'Rim Protector', color: 'text-green', icon: '🛡' }
  if (reb > 9  && pts > 14)             return { label: 'Two-Way Big', color: 'text-teal', icon: '💪' }
  if (ast > 5  && usg < 20)             return { label: 'Facilitator', color: 'text-purple', icon: '🤝' }
  if (stl > 1.8 && bpm > 1)             return { label: 'Two-Way Wing', color: 'text-teal', icon: '🔒' }
  if (pts > 16 && ts > 57)              return { label: 'Efficient Scorer', color: 'text-amber', icon: '✨' }
  if (usg < 16 && ts > 58)              return { label: 'Floor Spacer', color: 'text-blue', icon: '📐' }
  return { label: 'Role Player', color: 'text-txt-secondary', icon: '⭕' }
}

// Positionnement sur le graphe Volume vs Efficacité
export function getVolumeEfficiencyQuadrant(usg, ts) {
  if (!usg || !ts) return null
  if (usg >= 22 && ts >= 56) return { label: 'Efficient High-Usage', color: '#00c896', desc: 'Scorer élite — fort volume ET efficace' }
  if (usg >= 22 && ts <  56) return { label: 'Volume Scorer', color: '#ffaa00', desc: 'Scorer à fort volume, efficacité perfectible' }
  if (usg <  22 && ts >= 56) return { label: 'Efficient Role Player', color: '#4488ff', desc: 'Efficace dans un rôle limité — idéal pour soutien' }
  return { label: 'Limited Impact', color: '#ff4466', desc: 'Faible volume et faible efficacité — rôle à définir' }
}
