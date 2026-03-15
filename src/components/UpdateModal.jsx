'use client'

import { useState, useEffect } from 'react'

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="font-playfair text-gold text-sm font-semibold border-b border-gold/20 pb-2">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Field({ label, name, value, onChange, prefix = '£' }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
            {prefix}
          </span>
        )}
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          className={`input-field ${prefix ? 'pl-7' : ''}`}
          min="0"
          step="100"
        />
      </div>
    </div>
  )
}

export default function UpdateModal({ onClose, onSaved, wealth }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cashValues, setCashValues] = useState({})
  const [isaValues, setIsaValues] = useState({})
  const [pensionValues, setPensionValues] = useState({})
  const [form, setForm] = useState({
    propertyValue: '',
    mortgageBalance: '',
  })

  useEffect(() => {
    if (wealth) {
      const cash = {}
      wealth.cash.accounts.forEach((a) => { cash[a.id] = a.value })
      setCashValues(cash)

      const isa = {}
      wealth.isa.holdings.forEach((h) => { isa[h.id] = h.value })
      setIsaValues(isa)

      const pension = {}
      wealth.pension.holdings.forEach((h) => { pension[h.id] = h.value })
      setPensionValues(pension)

      setForm({
        propertyValue: wealth.property.primaryResidence.estimatedValue,
        mortgageBalance: wealth.property.primaryResidence.mortgageBalance,
      })
    }
  }, [wealth])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value === '' ? '' : Number(value) }))
  }

  const makeValueHandler = (setter) => (id, value) => {
    setter((prev) => ({ ...prev, [id]: value === '' ? '' : Number(value) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, cashValues, isaValues, pensionValues }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json()
      onSaved(updated)
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const cashAccounts = wealth?.cash?.accounts ?? []
  const isaHoldings = wealth?.isa?.holdings ?? []
  const pensionHoldings = wealth?.pension?.holdings ?? []

  function HoldingValueField({ holding, valueMap, onChange }) {
    return (
      <div>
        <label className="label">
          {holding.institution}
          {holding.name ? ` — ${holding.name}` : ''}
          {holding.symbol ? ` (${holding.symbol})` : ''}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
          <input
            type="number"
            value={valueMap[holding.id] ?? ''}
            onChange={(e) => onChange(holding.id, e.target.value)}
            className="input-field pl-7"
            min="0"
            step="100"
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card-dark border border-card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="font-playfair text-xl text-text-primary">Monthly Update</h2>
            <p className="text-text-muted text-xs mt-0.5">Enter current balances for each account</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* Cash & Savings */}
          <Section title="Cash & Savings">
            {cashAccounts.length === 0 ? (
              <p className="text-text-muted text-xs col-span-2">
                No cash accounts configured. Use ⚙ Manage on the Accounts tab.
              </p>
            ) : (
              cashAccounts.map((account) => (
                <div key={account.id}>
                  <label className="label">
                    {account.institution}
                    {account.type ? ` — ${account.type}` : ''}
                    {account.interestRate ? ` (${account.interestRate}% AER)` : ''}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
                    <input
                      type="number"
                      value={cashValues[account.id] ?? ''}
                      onChange={(e) => makeValueHandler(setCashValues)(account.id, e.target.value)}
                      className="input-field pl-7"
                      min="0"
                      step="100"
                    />
                  </div>
                </div>
              ))
            )}
          </Section>

          {/* ISA & Investments */}
          <Section title="ISA & Investments">
            {isaHoldings.length === 0 ? (
              <p className="text-text-muted text-xs col-span-2">
                No ISA holdings configured. Use ⚙ Manage on the Accounts tab.
              </p>
            ) : (
              isaHoldings.map((h) => (
                <HoldingValueField
                  key={h.id}
                  holding={h}
                  valueMap={isaValues}
                  onChange={makeValueHandler(setIsaValues)}
                />
              ))
            )}
          </Section>

          {/* Property */}
          <Section title="Property">
            <Field
              label="Property Estimated Value"
              name="propertyValue"
              value={form.propertyValue}
              onChange={handleChange}
            />
            <Field
              label="Mortgage Balance"
              name="mortgageBalance"
              value={form.mortgageBalance}
              onChange={handleChange}
            />
          </Section>

          {/* Pension */}
          <Section title="Pension">
            {pensionHoldings.length === 0 ? (
              <p className="text-text-muted text-xs col-span-2">
                No pension holdings configured. Use ⚙ Manage on the Accounts tab.
              </p>
            ) : (
              pensionHoldings.map((h) => (
                <HoldingValueField
                  key={h.id}
                  holding={h}
                  valueMap={pensionValues}
                  onChange={makeValueHandler(setPensionValues)}
                />
              ))
            )}
          </Section>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-text-muted text-sm hover:text-text-primary hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-gold text-bg-dark text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
