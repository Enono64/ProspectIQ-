export const STATUTS = [
  { value: '⭐ TOP PROSPECT', label: '⭐ Top Prospect', cls: 'badge-top' },
  { value: '🟢 PRIORITAIRE',  label: '🟢 Prioritaire',  cls: 'badge-prio' },
  { value: '🟡 À SURVEILLER', label: '🟡 À surveiller', cls: 'badge-watch' },
  { value: '🔵 EN VEILLE',    label: '🔵 En veille',    cls: 'badge-veil' },
  { value: '🔴 ÉCARTÉ',       label: '🔴 Écarté',       cls: 'badge-out' },
]

export const POSTES = ['PG', 'SG', 'SF', 'PF', 'C', 'PG/SG', 'SG/SF', 'SF/PF', 'PF/C']

export const LIGUES = [
  // USA
  'NBA', 'G-League', 'NBA 2-Way',
  // France
  'Betclic Élite', 'Pro B', 'NM1', 'NM2',
  // Europe — Clubs
  'EuroLeague', 'EuroCup', 'BCL',
  // Europe — Pays
  'Liga ACB (ESP)', 'Liga Endesa (ESP)',
  'BBL (GER)', 'Bundesliga (GER)',
  'Lega A (ITA)', 'Serie A2 (ITA)',
  'Basket League (GRE)',
  'BSL (TUR)', 'Süper Lig (TUR)',
  'VTB United (RUS)',
  'BNXT League (BEL/NED)',
  'Korisliiga (FIN)',
  'Basketligan (SWE)',
  'Ligaen (DEN)',
  'Blno (NOR)',
  'Bbl (GBR)',
  'Alpe Adria (SLO)',
  'ABA Liga (SRB)',
  'NBL (AUS)',
  // Amérique
  'NCAA', 'NAIA', 'JUCO',
  'Lega (MEX)',
  'LDB (BRA)',
  'LPB (ARG)',
  // Asie
  'CBA (CHN)',
  'KBL (KOR)',
  'B.League (JPN)',
  'SBL (TWN)',
  // Moyen-Orient / Afrique
  'Super Liga (ISR)',
  'BSL (LIB)',
  'BAL (AFR)',
  // Autre
  'Autre',
]

export const LEAGUE_COLOR = {
  'NBA':             '#E8601C',
  'G-League':        '#BA7517',
  'NBA 2-Way':       '#BA7517',
  'Betclic Élite':   '#AFA9EC',
  'Pro B':           '#7F77DD',
  'NM1':             '#534AB7',
  'NM2':             '#3C3489',
  'EuroLeague':      '#85B7EB',
  'EuroCup':         '#378ADD',
  'BCL':             '#185FA5',
  'Liga ACB (ESP)':  '#97C459',
  'BBL (GER)':       '#EF9F27',
  'Lega A (ITA)':    '#5DCAA5',
  'BSL (TUR)':       '#F09595',
  'Korisliiga (FIN)':'#5DCAA5',
  'Basketligan (SWE)':'#85B7EB',
  'BNXT League (BEL/NED)': '#AFA9EC',
  'NCAA':            '#5DCAA5',
  'NBL (AUS)':       '#EF9F27',
  'CBA (CHN)':       '#F09595',
  'BAL (AFR)':       '#97C459',
  'Autre':           '#888780',
}

export function getBadgeClass(status) {
  const s = STATUTS.find(s => s.value === status)
  return s?.cls || 'badge-veil'
}

export function gradeColor(note) {
  if (note >= 9) return 'text-teal-light'
  if (note >= 8) return 'text-green-light'
  if (note >= 7) return 'text-amber-light'
  if (note >= 6) return 'text-orange'
  return 'text-red-light'
}

export function fmt(val, decimals = 1) {
  if (val == null || val === '') return '—'
  return Number(val).toFixed(decimals)
}

export function bpmColor(val) {
  if (val == null) return 'stat-ok'
  if (val >= 2)   return 'stat-pos'
  if (val >= 0)   return 'stat-ok'
  return 'stat-neg'
}

export const POSTE_STYLE = {
  PG: 'bg-purple-dim text-purple-light',
  SG: 'bg-purple-dim text-purple',
  SF: 'bg-blue-dim text-blue-light',
  PF: 'bg-teal-dim text-teal-light',
  C:  'bg-orange-dim text-orange',
}

export function posteStyle(pos) {
  const base = pos?.split('/')?.[0]
  return POSTE_STYLE[base] || 'bg-bg-card text-txt-muted'
}

export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Saison en cours dynamique
export function currentSeason() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  // La saison commence en septembre
  if (month >= 9) return `${year}-${String(year + 1).slice(2)}`
  return `${year - 1}-${String(year).slice(2)}`
}
