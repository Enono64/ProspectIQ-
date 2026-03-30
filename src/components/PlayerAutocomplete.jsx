import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

export default function PlayerAutocomplete({ onSelect }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const debounce                = useRef(null)
  const wrapRef                 = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounce.current)
    if (q.length < 3) { setResults([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.searchPlayers(q)
        setResults(data || [])
        setOpen(true)
      } catch { setResults([]) }
      setLoading(false)
    }, 400)
  }

  function handleSelect(player) {
    setQuery(player.name)
    setOpen(false)
    onSelect({
      first_name:  player.firstname || player.name.split(' ')[0] || '',
      last_name:   player.lastname  || player.name.split(' ').slice(1).join(' ') || '',
      position:    player.position  || '',
      nationality: player.country   || '',
      age:         player.age       || '',
      height_cm:   player.height ? parseInt(player.height) : '',
      weight_kg:   player.weight ? parseInt(player.weight) : '',
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="label">Recherche rapide (API)</label>
      <div className="relative">
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="input text-xs pr-8"
          placeholder="Tape un nom... (min 3 lettres)"
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-txt-muted text-xs animate-spin">⟳</div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-bg-card border border-bg-border2 rounded-lg shadow-xl overflow-hidden">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors text-left border-b border-bg-border last:border-0"
            >
              <div className="w-7 h-7 rounded-lg bg-bg-hover border border-bg-border2 flex items-center justify-center text-[10px] font-bold text-txt-muted flex-shrink-0">
                {p.firstname?.[0]}{p.lastname?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-txt-primary truncate">{p.name}</div>
                <div className="text-[10px] text-txt-muted">
                  {p.position} · {p.country} {p.age ? `· ${p.age} ans` : ''} {p.height ? `· ${p.height}` : ''}
                </div>
              </div>
              <span className="text-[10px] text-acc flex-shrink-0">Sélectionner →</span>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && query.length >= 3 && (
        <div className="absolute z-50 w-full mt-1 bg-bg-card border border-bg-border2 rounded-lg p-3 text-xs text-txt-muted">
          Aucun résultat — utilise l'autofill IA
        </div>
      )}
    </div>
  )
}
