import { useState } from 'react'
import { api } from '../lib/api'

const PRESET_TAGS = [
  'Draft 2025', 'Draft 2026', 'Draft 2027',
  'Priorité été', 'Priorité hiver',
  'Blessure', 'Blessure genou', 'Blessure épaule',
  'Libre', 'Option', 'Buyout possible',
  'EuroLeague ready', 'NBA ready',
  'À revoir', 'Refusé', 'Contacté',
  'Piste chaude', 'En négociation',
]

const TAG_COLORS = [
  'bg-purple/10 text-purple border-purple/20',
  'bg-blue/10 text-blue border-blue/20',
  'bg-teal/10 text-teal border-teal/20',
  'bg-amber/10 text-amber border-amber/20',
  'bg-red/10 text-red border-red/20',
  'bg-green/10 text-green border-green/20',
]

function getTagColor(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export default function TagsManager({ player, onUpdate }) {
  const [tags, setTags]       = useState(() => {
    if (!player.tags) return []
    if (typeof player.tags === 'string') {
      try { return JSON.parse(player.tags) } catch { return [] }
    }
    return player.tags || []
  })
  const [input, setInput]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  async function saveTags(newTags) {
    setSaving(true)
    try {
      await api.updatePlayer(player.id, { tags: JSON.stringify(newTags) })
      onUpdate?.({ ...player, tags: newTags })
    } catch (e) { alert('Erreur : ' + e.message) }
    setSaving(false)
  }

  function addTag(tag) {
    const t = tag.trim()
    if (!t || tags.includes(t)) return
    const newTags = [...tags, t]
    setTags(newTags)
    setInput('')
    saveTags(newTags)
  }

  function removeTag(tag) {
    const newTags = tags.filter(t => t !== tag)
    setTags(newTags)
    saveTags(newTags)
  }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
    if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1])
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tags actuels */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.map(tag => (
          <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${getTagColor(tag)}`}>
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:opacity-70 transition-opacity ml-0.5">✕</button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-[10px] text-txt-muted">Aucun tag</span>}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          className="input text-xs flex-1"
          placeholder="Nouveau tag... (Enter pour ajouter)"
        />
        <button onClick={() => addTag(input)} className="btn-ghost text-xs" disabled={!input.trim()}>+</button>
        <button onClick={() => setShowPresets(!showPresets)} className="btn-ghost text-xs">
          Suggestions
        </button>
      </div>

      {/* Tags prédéfinis */}
      {showPresets && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-bg-hover rounded-lg border border-bg-border">
          {PRESET_TAGS.filter(t => !tags.includes(t)).map(tag => (
            <button
              key={tag}
              onClick={() => { addTag(tag); }}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all hover:scale-105 ${getTagColor(tag)}`}
            >
              + {tag}
            </button>
          ))}
        </div>
      )}

      {saving && <div className="text-[10px] text-txt-muted animate-pulse">Sauvegarde...</div>}
    </div>
  )
}
