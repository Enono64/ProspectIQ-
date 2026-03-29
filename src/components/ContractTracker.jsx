import { useState } from 'react'
import { api } from '../lib/api'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function urgencyColor(days) {
  if (days == null) return 'text-txt-muted'
  if (days < 0)    return 'text-red'
  if (days < 90)   return 'text-red'
  if (days < 180)  return 'text-amber'
  if (days < 365)  return 'text-teal'
  return 'text-txt-secondary'
}

function urgencyLabel(days) {
  if (days == null) return '—'
  if (days < 0)    return `Expiré il y a ${Math.abs(days)} jours`
  if (days < 30)   return `🔴 Expire dans ${days} jours`
  if (days < 90)   return `🟠 Expire dans ${days} jours`
  if (days < 180)  return `🟡 Expire dans ${Math.round(days/30)} mois`
  return `🟢 Expire dans ${Math.round(days/30)} mois`
}

export default function ContractTracker({ player, onUpdate }) {
  const [form, setForm] = useState({
    contract_end:    player.contract_end    || '',
    contract_salary: player.contract_salary || '',
    contract_option: player.contract_option || '',
    buyout_clause:   player.buyout_clause   || '',
    agent_name:      player.agent_name      || '',
    agent_email:     player.agent_email     || '',
    agent_phone:     player.agent_phone     || '',
    market_value:    player.market_value    || '',
  })
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const days = daysUntil(form.contract_end)

  async function handleSave() {
    setSaving(true)
    try {
      await api.updatePlayer(player.id, form)
      onUpdate?.({ ...player, ...form })
    } catch (e) { alert('Erreur : ' + e.message) }
    setSaving(false)
  }

  async function estimateMarketValue() {
    setAiLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/players/${player.id}/market-value`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await import('../lib/api').then(m => m.getToken()))}`
        }
      })
      const data = await res.json()
      if (data.market_value) {
        set('market_value', data.market_value)
      }
    } catch (e) { alert('Erreur : ' + e.message) }
    setAiLoading(false)
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Status contrat */}
      {form.contract_end && (
        <div className={`card p-3 flex items-center gap-3 ${days < 90 ? 'border-red/30 bg-red/5' : days < 180 ? 'border-amber/30 bg-amber/5' : 'border-teal/20'}`}>
          <span className="text-xl">⏰</span>
          <div>
            <div className={`text-sm font-semibold ${urgencyColor(days)}`}>{urgencyLabel(days)}</div>
            <div className="text-[10px] text-txt-muted mt-0.5">Fin de contrat : {form.contract_end}</div>
          </div>
          {days < 180 && (
            <div className="ml-auto">
              <span className="text-[10px] px-2 py-1 rounded bg-acc/10 text-acc border border-acc/20 font-semibold">
                ACTION REQUISE
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">

        {/* Contrat */}
        <div className="card p-4">
          <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Contrat</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="label">Fin de contrat</label>
              <input type="date" value={form.contract_end} onChange={e => set('contract_end', e.target.value)} className="input text-xs mono" />
            </div>
            <div>
              <label className="label">Salaire estimé</label>
              <input value={form.contract_salary} onChange={e => set('contract_salary', e.target.value)} className="input text-xs" placeholder="ex: 300 000 € / an" />
            </div>
            <div>
              <label className="label">Option / clause</label>
              <input value={form.contract_option} onChange={e => set('contract_option', e.target.value)} className="input text-xs" placeholder="Option club, joueur..." />
            </div>
            <div>
              <label className="label">Buyout</label>
              <input value={form.buyout_clause} onChange={e => set('buyout_clause', e.target.value)} className="input text-xs" placeholder="Montant du buyout" />
            </div>
          </div>
        </div>

        {/* Agent */}
        <div className="card p-4">
          <div className="text-[10px] text-txt-muted uppercase tracking-widest mb-3">Agent</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="label">Nom</label>
              <input value={form.agent_name} onChange={e => set('agent_name', e.target.value)} className="input text-xs" placeholder="Prénom Nom" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.agent_email} onChange={e => set('agent_email', e.target.value)} className="input text-xs" placeholder="agent@exemple.com" />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input value={form.agent_phone} onChange={e => set('agent_phone', e.target.value)} className="input text-xs" placeholder="+33 6 00 00 00 00" />
            </div>
          </div>
        </div>

      </div>

      {/* Valeur marchande */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-txt-muted uppercase tracking-widest">Valeur marchande</div>
          <button onClick={estimateMarketValue} disabled={aiLoading} className="btn-ghost text-xs py-1">
            {aiLoading ? '🤖 Estimation...' : '🤖 Estimer par IA'}
          </button>
        </div>
        <input
          value={form.market_value}
          onChange={e => set('market_value', e.target.value)}
          className="input text-xs mono"
          placeholder="ex: 500 000 — 800 000 €"
        />
        {form.market_value && (
          <div className="mt-2 text-xs text-teal font-semibold">{form.market_value}</div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
        {saving ? 'Sauvegarde...' : '💾 Sauvegarder'}
      </button>
    </div>
  )
}
