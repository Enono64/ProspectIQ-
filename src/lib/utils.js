// Statuts joueurs
export const STATUTS = [
  { value: '⭐ TOP PROSPECT', label: '⭐ Top Prospect', cls: 'badge-top' },
  { value: '🟢 PRIORITAIRE',  label: '🟢 Prioritaire',  cls: 'badge-prio' },
  { value: '🟡 À SURVEILLER', label: '🟡 À surveiller', cls: 'badge-watch' },
  { value: '🔵 EN VEILLE',    label: '🔵 En veille',    cls: 'badge-veil' },
  { value: '🔴 ÉCARTÉ',       label: '🔴 Écarté',       cls: 'badge-out' },
]

export const POSTES = ['PG', 'SG', 'SF', 'PF', 'C']

export const LIGUES = [
  'NBA', 'G-League', 'Betclic Élite', 'Pro B', 'NM1',
  'EuroLeague', 'EuroCup', 'Liga ACB', 'BBL', 'BNXT', 'NCAA', 'Autre'
]

// Couleur par ligue
export const LEAGUE_COLOR = {
  'NBA':           '#E8601C',
  'G-League':      '#BA7517',
  'Betclic Élite': '#AFA9EC',
  'Pro B':         '#7F77DD',
  'NM1':           '#534AB7',
  'EuroLeague':    '#85B7EB',
  'EuroCup':       '#378ADD',
  'NCAA':          '#5DCAA5',
  'Liga ACB':      '#97C459',
  'BBL':           '#EF9F27',
  'Autre':         '#888780',
}

// Badge statut
export function getBadgeClass(status) {
  const s = STATUTS.find(s => s.value === status)
  return s?.cls || 'badge-veil'
}

// Couleur note
export function gradeColor(note) {
  if (note >= 9) return 'text-teal-light'
  if (note >= 8) return 'text-green-light'
  if (note >= 7) return 'text-amber-light'
  if (note >= 6) return 'text-orange'
  return 'text-red-light'
}

// Format stat (arrondi propre)
export function fmt(val, decimals = 1) {
  if (val == null || val === '') return '—'
  return Number(val).toFixed(decimals)
}

// Classe couleur stat selon valeur BPM
export function bpmColor(val) {
  if (val == null) return 'stat-ok'
  if (val >= 2)   return 'stat-pos'
  if (val >= 0)   return 'stat-ok'
  return 'stat-neg'
}

// Poste → couleur badge
export const POSTE_STYLE = {
  PG: 'bg-purple-dim text-purple-light',
  SG: 'bg-purple-dim text-purple',
  SF: 'bg-blue-dim text-blue-light',
  PF: 'bg-teal-dim text-teal-light',
  C:  'bg-orange-dim text-orange',
}

export function posteStyle(pos) {
  return POSTE_STYLE[pos] || 'bg-bg-card text-txt-muted'
}

// Formatage date
export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
