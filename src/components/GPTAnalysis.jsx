import { useState } from 'react'
import { supabase } from '../lib/api'

const MODES = [
  { id: 'auto',         icon: '🧠', label: 'Auto',          desc: 'Choisit le bon agent automatiquement' },
  { id: 'barttorvik',   icon: '📊', label: 'Barttorvik',    desc: 'Lecture expert données Barttorvik NCAA' },
  { id: 'ncaa',         icon: '🎓', label: 'Scout NCAA',    desc: 'Analyse NCAA → recrutement France/Europe' },
  { id: 'instat',       icon: '📈', label: 'InStat',        desc: 'Analyse données InStat, playtypes, shot chart' },
  { id: 'europe',       icon: '🌍', label: 'Europe',        desc: 'Projection FIBA, fit collectif, marché' },
  { id: 'sqbb',         icon: '🏀', label: 'SQBB',          desc: 'Fit projet Saint-Quentin Basket-Ball' },
  { id: 'shortlist',    icon: '📋', label: 'Shortlist',     desc: 'Shortlist recrutement hiérarchisée' },
  { id: 'player_finder',icon: '🔍', label: 'Player Finder', desc: 'Trouve des profils selon un besoin précis' },
]

const MODE_COLORS = {
  barttorvik: '#4488ff', ncaa: '#00c896', instat: '#9966ff',
  europe: '#ffaa00', sqbb: '#ff4500', shortlist: '#00c896',
  player_finder: '#ff4500', auto: '#888',
}

function ExternalLinks({ player }) {
  const name = encodeURIComponent(`${player.first_name} ${player.last_name}`)
  const isNCAA = player.league?.toLowerCase().includes('ncaa')

  const links = [
    { label: 'ESPN', url: `https://www.espn.com/search/results?q=${name}`, icon: '📺' },
    { label: 'Basketball-Ref', url: `https://www.basketball-reference.com/search/search.fcgi?search=${name}`, icon: '📊' },
    isNCAA && { label: 'Barttorvik', url: `https://barttorvik.com/#`, icon: '📈' },
    isNCAA && { label: '247Sports', url: `https://247sports.com/search/?q=${name}`, icon: '🏈' },
    { label: 'EuroBasket', url: `https://www.eurobasket.com/search.aspx?s=${name}`, icon: '🌍' },
    { label: 'ProBallers', url: `https://www.proballers.com/search?query=${name}`, icon: '🔍' },
  ].filter(Boolean)

  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map(l => (
        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
          className="text-[10px] px-2 py-1 rounded border border-bg-border text-txt-muted hover:text-acc hover:border-acc/30 transition-colors">
          {l.icon} {l.label}
        </a>
      ))}
    </div>
  )
}

export default function GPTAnalysis({ player }) {
  const [loading, setLoading]   = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [mode, setMode]         = useState('auto')
  const [error, setError]       = useState('')
  const [usedMode, setUsedMode] = useState('')

  const hasStats = player.pts || player.ast || player.reb || player.fg_pct

  async function runAnalysis() {
    setLoading(true); setError(''); setAnalysis(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const resp = await fetch(import.meta.env.VITE_API_URL + '/players/' + player.id + '/gpt-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ mode })
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error)
      setAnalysis(data.analysis)
      setUsedMode(data.mode)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const currentMode = MODES.find(m => m.id === usedMode) || MODES.find(m => m.id === mode)

  return (
    <div className="flex flex-col gap-4">

      {/* Liens externes */}
      <div className="card p-3">
        <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-2">🔗 Rechercher {player.first_name} {player.last_name}</div>
        <ExternalLinks player={player} />
      </div>

      {/* Sélecteur d'agents */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-txt-primary">🧠 Agents GPT-4o</div>
            <div className="text-xs text-txt-muted mt-0.5">8 cerveaux spécialisés · {player.first_name} {player.last_name}</div>
          </div>
          <button onClick={runAnalysis} disabled={loading || !hasStats}
            className="btn-primary text-xs px-4 py-2">
            {loading ? '🧠 Analyse...' : '▶ Lancer'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                mode === m.id
                  ? 'border-acc/50 bg-acc/10 text-acc'
                  : 'border-bg-border text-txt-muted hover:border-bg-border2 hover:text-txt-secondary'
              }`}>
              <div className="font-semibold">{m.icon} {m.label}</div>
              <div className="text-[10px] mt-0.5 opacity-70 leading-tight">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {!hasStats && (
        <div className="card p-4 text-center text-sm text-txt-muted">
          Importe les stats InStat ou lance un autofill pour activer les agents GPT
        </div>
      )}

      {error && (
        <div className="text-red text-xs bg-red/5 border border-red/20 rounded-lg p-3">❌ {error}</div>
      )}

      {loading && (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3 animate-pulse">{currentMode?.icon || '🧠'}</div>
          <div className="text-sm text-txt-secondary font-medium">{currentMode?.label} en cours...</div>
          <div className="text-xs text-txt-muted mt-1">{currentMode?.desc}</div>
        </div>
      )}

      {analysis && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] px-2 py-1 rounded border font-semibold uppercase tracking-wider"
              style={{ borderColor: MODE_COLORS[usedMode] + '50', background: MODE_COLORS[usedMode] + '15', color: MODE_COLORS[usedMode] }}>
              {currentMode?.icon} {currentMode?.label}
            </span>
            <span className="text-[10px] text-txt-muted">GPT-4o · {player.league}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            {analysis.split('\n').map((line, i) => {
              const clean = line.trim()
              if (!clean) return <div key={i} className="h-2" />
              const isH2 = clean.startsWith('##')
              const isH3 = clean.startsWith('###')
              const isBullet = clean.startsWith('-') || clean.startsWith('•') || clean.startsWith('*')
              const isNumbered = /^\d+\./.test(clean)
              const isVerdict = clean.toLowerCase().includes('verdict') || clean.toLowerCase().includes('recommandation')

              if (isH2 || isH3) return (
                <div key={i} className="text-[10px] font-bold uppercase tracking-wider mt-4 mb-1"
                  style={{ color: MODE_COLORS[usedMode] || '#ff4500' }}>
                  {clean.replace(/^#{2,3}\s*/, '')}
                </div>
              )
              if (isVerdict) return (
                <p key={i} className="text-xs font-semibold text-acc leading-relaxed mt-1">{clean}</p>
              )
              if (isBullet || isNumbered) return (
                <p key={i} className="text-xs text-txt-secondary leading-relaxed pl-3">{clean}</p>
              )
              return (
                <p key={i} className="text-xs text-txt-secondary leading-relaxed">{clean}</p>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
