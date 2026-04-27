import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const MODES = [
  { id: 'barttorvik',       label: 'Barttorvik NCAA',     emoji: '📊', desc: 'Stats NCAA → traduction Europe' },
  { id: 'ncaa',             label: 'Scout NCAA',           emoji: '🏫', desc: 'Analyse recrutement NCAA complet' },
  { id: 'europe',           label: 'Marché Européen',      emoji: '🌍', desc: 'BBL, ACB, Betclic, EuroLeague...' },
  { id: 'sqbb',             label: 'Fit SQBB',             emoji: '🏀', desc: 'Compatibilité projet Saint-Quentin' },
  { id: 'instat',           label: 'Analyse InStat',       emoji: '📈', desc: 'Playtypes, splits, transposabilité' },
  { id: 'shortlist',        label: 'Shortlist',            emoji: '📋', desc: 'Profils similaires accessibles' },
  { id: 'player_finder',    label: 'Player Finder',        emoji: '🔍', desc: 'Identifier profils sur le marché' },
  { id: 'video_plan',       label: 'Plan Vidéo',           emoji: '🎬', desc: 'Plan de visionnage scout' },
  { id: 'emerging_markets', label: 'Marchés Émergents',    emoji: '🌱', desc: 'Kosovo, Chypre, Roumanie...' },
  { id: 'gleague',          label: 'G-League Scout',       emoji: '⭐', desc: 'Analyse profils G-League' },
]

const LEAGUES = [
  'NBA','EuroLeague','EuroCup','BCL','BBL (GER)','Pro A (GER)',
  'Betclic Elite','Pro B','NM1','Liga ACB (ESP)','Lega A (ITA)',
  'BSL (TUR)','NCAA','G-League','BNXT League','Adriatique','Ligue VTB',
]

const S = {
  wrap:      { padding: '28px 32px', maxWidth: 960, margin: '0 auto' },
  card:      { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: 20, marginBottom: 16 },
  label:     { fontSize: 11, color: '#aaa', display: 'block', marginBottom: 5 },
  sectionLbl:{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 },
  input:     { width: '100%', padding: '8px 12px', border: '1px solid #e8e8e8', borderRadius: 6, fontSize: 13, outline: 'none', color: '#1a1a1a', fontFamily: 'inherit' },
  select:    { width: '100%', padding: '8px 12px', border: '1px solid #e8e8e8', borderRadius: 6, fontSize: 13, outline: 'none', color: '#1a1a1a', background: '#fff' },
  textarea:  { width: '100%', padding: '8px 12px', border: '1px solid #e8e8e8', borderRadius: 6, fontSize: 12, outline: 'none', color: '#555', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 },
  btnMain:   (disabled) => ({ width: '100%', padding: 11, background: disabled ? '#e8e8e8' : '#1e2433', color: disabled ? '#aaa' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', marginBottom: 16 }),
  btnGreen:  (disabled) => ({ padding: '6px 14px', background: disabled ? '#e8f5e9' : '#00b87a', color: disabled ? '#2e7d32' : '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap' }),
  error:     { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#dc2626' },
  success:   { background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modeItem:  (active) => ({ padding: '10px 14px', background: active ? '#f0fdf8' : '#fff', border: `1px solid ${active ? '#00b87a' : '#e8e8e8'}`, borderRadius: 8, cursor: 'pointer', marginBottom: 6 }),
}

export default function GPTAnalysis() {
  const navigate = useNavigate()
  const [playerName, setPlayerName] = useState('')
  const [league, setLeague]         = useState('')
  const [mode, setMode]             = useState('europe')
  const [extraNotes, setExtraNotes] = useState('')
  const [loading, setLoading]       = useState(false)
  const [report, setReport]         = useState(null)
  const [adding, setAdding]         = useState(false)
  const [added, setAdded]           = useState(null)
  const [error, setError]           = useState(null)

  const selectedMode = MODES.find(m => m.id === mode)

  async function handleAnalyze() {
    if (!playerName.trim()) return
    setLoading(true); setReport(null); setError(null); setAdded(null)
    try {
      const query = `Joueur : ${playerName}${league ? ` | Ligue : ${league}` : ''}${extraNotes ? `\n\nInfos supplémentaires :\n${extraNotes}` : ''}\n\nFais une analyse complète de ce joueur.`
      const res = await api.gptSearch(query, mode)
      setReport(res)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleAddToBase() {
    if (!playerName.trim()) return
    setAdding(true); setError(null)
    try {
      const res = await api.autofill(playerName, league)
      if (!res?.player) throw new Error('Autofill échoué — vérifie le nom du joueur')
      const player = await api.createPlayer(res.player)
      setAdded(player)
    } catch (e) { setError(e.message) }
    finally { setAdding(false) }
  }

  function renderReport(text) {
    return text.split('\n').map((line, i) => {
      const t = line.trim()
      if (!t) return <div key={i} style={{ height: 8 }} />
      const isTitle = t.startsWith('##') || t.startsWith('# ') || (t.length < 80 && t.endsWith(':') && !t.includes('.') && !t.startsWith('-'))
      const clean = t.replace(/^#{1,3}\s*/,'').replace(/\*\*/g,'').replace(/\*/g,'')
      if (isTitle) return <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 18, marginBottom: 6, paddingBottom: 5, borderBottom: '1px solid #f0f0f0' }}>{clean}</div>
      if (clean.startsWith('-') || clean.startsWith('•')) return <div key={i} style={{ fontSize: 13, color: '#444', lineHeight: 1.7, paddingLeft: 12, borderLeft: '2px solid #f0f0f0', marginBottom: 3 }}>{clean.slice(1).trim()}</div>
      return <p key={i} style={{ fontSize: 13, color: '#444', lineHeight: 1.75, margin: '3px 0' }}>{clean}</p>
    })
  }

  return (
    <div style={S.wrap}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 21, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>GPT Analysis</h1>
        <p style={{ fontSize: 12, color: '#aaa' }}>Analyse un joueur avec l'IA, puis ajoute-le à ta base si il t'intéresse.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* GAUCHE */}
        <div>
          <div style={S.card}>
            <div style={S.sectionLbl}>Joueur</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Nom *</label>
                <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="ex: Killian Hayes" onKeyDown={e => e.key === 'Enter' && handleAnalyze()} style={S.input} />
              </div>
              <div style={{ width: 170 }}>
                <label style={S.label}>Ligue</label>
                <select value={league} onChange={e => setLeague(e.target.value)} style={S.select}>
                  <option value="">Toutes ligues</option>
                  {LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <label style={S.label}>Stats / notes supplémentaires (optionnel)</label>
            <textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)} placeholder="Colle ici des stats InStat, Barttorvik, observations terrain..." rows={4} style={S.textarea} />
          </div>

          <button onClick={handleAnalyze} disabled={!playerName.trim() || loading} style={S.btnMain(!playerName.trim() || loading)}>
            {loading ? '⏳ Analyse en cours...' : `${selectedMode?.emoji} Analyser — ${selectedMode?.label}`}
          </button>

          {error && <div style={S.error}>❌ {error}</div>}

          {report?.analysis && (
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#1e2433', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{selectedMode?.emoji} {selectedMode?.label} — {playerName}{league ? ` · ${league}` : ''}</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Rapport généré par GPT-4o</div>
                </div>
                <button onClick={handleAddToBase} disabled={adding || !!added} style={S.btnGreen(adding || !!added)}>
                  {added ? '✅ Ajouté' : adding ? 'Ajout...' : '+ Ajouter à ma base'}
                </button>
              </div>

              {added && (
                <div style={S.success}>
                  <span style={{ fontSize: 12, color: '#166534', fontWeight: 500 }}>✅ {added.first_name} {added.last_name} ajouté !</span>
                  <button onClick={() => navigate(`/players/${added.id}`)} style={{ padding: '4px 12px', background: '#00b87a', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    Voir la fiche →
                  </button>
                </div>
              )}

              <div style={{ padding: '20px', maxHeight: 600, overflowY: 'auto' }}>
                {renderReport(report.analysis)}
              </div>
            </div>
          )}
        </div>

        {/* DROITE — Modes */}
        <div>
          <div style={S.sectionLbl}>Type d'analyse</div>
          {MODES.map(m => (
            <div key={m.id} onClick={() => setMode(m.id)} style={S.modeItem(mode === m.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{m.emoji}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: mode === m.id ? 600 : 400, color: mode === m.id ? '#00b87a' : '#1a1a1a' }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{m.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
