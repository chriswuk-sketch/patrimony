'use client'

import { useState } from 'react'

const PALETTE = ['#ff6b6b', '#4cc97a', '#4c8ec9', '#c9a84c', '#9b4cc9', '#4cc9c9', '#ff9f43', '#a29bfe']

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

// Inline price-test badge
function PriceBadge({ status, price }) {
  if (status === 'loading') return <span className="text-xs text-text-muted animate-pulse">Fetching…</span>
  if (status === 'ok') return (
    <span className="text-xs text-green-400 font-mono">
      £{price?.toFixed(2)} ✓
    </span>
  )
  if (status === 'error') return <span className="text-xs text-red-400">Not found</span>
  return null
}

export default function ManageHoldingsModal({ holdings, type, title, onClose, onSaved }) {
  const postKey = type === 'isa' ? 'isaHoldings' : 'pensionHoldings'

  const [rows, setRows] = useState(
    holdings.map((h) => ({
      ...h,
      _hasUnits: h.units != null,
      _priceStatus: null,
      _priceValue: null,
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (id, field, value) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const addHolding = () =>
    setRows((prev) => [
      ...prev,
      {
        id: generateId(),
        institution: '',
        name: '',
        symbol: '',
        units: null,
        value: 0,
        _hasUnits: false,
        _priceStatus: null,
        _priceValue: null,
      },
    ])

  const removeHolding = (id) => setRows((prev) => prev.filter((r) => r.id !== id))

  const toggleUnits = (id) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, _hasUnits: !r._hasUnits, units: !r._hasUnits ? 0 : null } : r
      )
    )

  const fetchPrice = async (id, symbol) => {
    if (!symbol?.trim()) return
    update(id, '_priceStatus', 'loading')
    try {
      const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol.trim())}`)
      const data = await res.json()
      if (data.fallback) {
        update(id, '_priceStatus', 'error')
        update(id, '_priceValue', null)
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, _priceStatus: 'ok', _priceValue: data.price }
              : r
          )
        )
      }
    } catch {
      update(id, '_priceStatus', 'error')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const holdingsPayload = rows.map(({ _hasUnits, _priceStatus, _priceValue, ...rest }) => ({
        ...rest,
        symbol: rest.symbol?.trim() || null,
        units: _hasUnits ? (Number(rest.units) || 0) : null,
        value: Number(rest.value) || 0,
      }))

      const res = await fetch('/api/wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [postKey]: holdingsPayload }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json()
      onSaved(updated)
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card-dark border border-card-border rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="font-playfair text-xl text-text-primary">Manage {title}</h2>
            <p className="text-text-muted text-xs mt-0.5">
              Add holdings with a ticker symbol or ISIN to enable live prices
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {/* Holdings list */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {rows.length === 0 && (
            <p className="text-text-muted text-sm text-center py-6">
              No holdings yet. Add one below.
            </p>
          )}

          {rows.map((row, i) => (
            <div
              key={row.id}
              className="rounded-xl border border-white/5 bg-bg-dark p-4 space-y-3"
            >
              {/* Row header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="text-xs text-text-muted uppercase tracking-wide">
                    Holding {i + 1}
                  </span>
                </div>
                <button
                  onClick={() => removeHolding(row.id)}
                  className="text-text-muted hover:text-red-400 transition-colors text-xs"
                >
                  Remove
                </button>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-3">
                {/* Institution */}
                <div>
                  <label className="label">Institution / Provider</label>
                  <input
                    type="text"
                    value={row.institution}
                    onChange={(e) => update(row.id, 'institution', e.target.value)}
                    placeholder="e.g. Vanguard"
                    className="input-field"
                  />
                </div>

                {/* Fund name */}
                <div>
                  <label className="label">Fund Name</label>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => update(row.id, 'name', e.target.value)}
                    placeholder="e.g. FTSE Global All Cap"
                    className="input-field"
                  />
                </div>

                {/* Symbol / ISIN */}
                <div className="col-span-2">
                  <label className="label">Ticker Symbol or ISIN (optional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={row.symbol ?? ''}
                      onChange={(e) => {
                        update(row.id, 'symbol', e.target.value)
                        update(row.id, '_priceStatus', null)
                      }}
                      placeholder="e.g. VWRP.L or IE00B3RBWM25"
                      className="input-field flex-1 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => fetchPrice(row.id, row.symbol)}
                      disabled={!row.symbol?.trim() || row._priceStatus === 'loading'}
                      className="px-3 py-2 rounded-lg border border-white/10 text-xs text-text-muted hover:text-gold hover:border-gold/40 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      Test price
                    </button>
                  </div>
                  {row._priceStatus && (
                    <div className="mt-1.5">
                      <PriceBadge status={row._priceStatus} price={row._priceValue} />
                    </div>
                  )}
                </div>

                {/* Value */}
                <div>
                  <label className="label">Current Value</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) => update(row.id, 'value', e.target.value)}
                      className="input-field pl-7"
                      min="0"
                      step="100"
                    />
                  </div>
                </div>

                {/* Units toggle */}
                <div>
                  <label className="label">Units Held</label>
                  {row._hasUnits ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={row.units ?? ''}
                        onChange={(e) => update(row.id, 'units', e.target.value)}
                        placeholder="e.g. 200.5"
                        className="input-field flex-1"
                        min="0"
                        step="0.01"
                      />
                      <button
                        type="button"
                        onClick={() => toggleUnits(row.id)}
                        className="text-xs text-text-muted hover:text-red-400 transition-colors px-2 border border-white/10 rounded-lg"
                        title="Remove units"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleUnits(row.id)}
                      className="w-full input-field text-left text-text-muted text-sm hover:border-gold/40 hover:text-gold transition-colors"
                    >
                      + Track units
                    </button>
                  )}
                </div>
              </div>

              {/* Value preview if price and units known */}
              {row._priceStatus === 'ok' && row._hasUnits && row.units && (
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-text-muted">
                    {row.units} units × £{row._priceValue?.toFixed(2)}
                  </span>
                  <span className="text-gold font-playfair">
                    ≈ £{Math.round(Number(row.units) * row._priceValue).toLocaleString('en-GB')}
                  </span>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addHolding}
            className="w-full py-3 rounded-xl border border-dashed border-white/10 text-text-muted text-sm hover:border-gold/40 hover:text-gold transition-colors"
          >
            + Add Holding
          </button>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex-shrink-0 space-y-3">
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-text-muted text-sm hover:text-text-primary hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-gold text-bg-dark text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Holdings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
