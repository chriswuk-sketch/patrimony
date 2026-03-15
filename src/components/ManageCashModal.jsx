'use client'

import { useState } from 'react'

const PALETTE = ['#ff6b6b', '#4cc97a', '#4c8ec9', '#c9a84c', '#9b4cc9', '#4cc9c9', '#ff9f43', '#a29bfe']

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function ManageCashModal({ accounts, onClose, onSaved }) {
  const [rows, setRows] = useState(
    accounts.map((a) => ({ ...a, _hasInterest: a.interestRate !== null && a.interestRate !== undefined }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  const addAccount = () => {
    setRows((prev) => [
      ...prev,
      { id: generateId(), institution: '', type: '', value: 0, interestRate: null, _hasInterest: false },
    ])
  }

  const removeAccount = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const toggleInterest = (id) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, _hasInterest: !r._hasInterest, interestRate: !r._hasInterest ? 0 : null }
          : r
      )
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const cashAccounts = rows.map(({ _hasInterest, ...rest }) => ({
        ...rest,
        value: Number(rest.value) || 0,
        interestRate: _hasInterest ? (Number(rest.interestRate) || 0) : null,
      }))

      const res = await fetch('/api/wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashAccounts }),
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
            <h2 className="font-playfair text-xl text-text-primary">Manage Cash Accounts</h2>
            <p className="text-text-muted text-xs mt-0.5">Add, edit or remove accounts and interest rates</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {/* Account list */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {rows.length === 0 && (
            <p className="text-text-muted text-sm text-center py-6">
              No accounts yet. Add one below.
            </p>
          )}

          {rows.map((row, i) => (
            <div
              key={row.id}
              className="rounded-xl border border-white/5 bg-bg-dark p-4 space-y-3"
            >
              {/* Row header with colour dot and delete */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="text-xs text-text-muted uppercase tracking-wide">
                    Account {i + 1}
                  </span>
                </div>
                <button
                  onClick={() => removeAccount(row.id)}
                  className="text-text-muted hover:text-red-400 transition-colors text-xs"
                >
                  Remove
                </button>
              </div>

              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Institution</label>
                  <input
                    type="text"
                    value={row.institution}
                    onChange={(e) => update(row.id, 'institution', e.target.value)}
                    placeholder="e.g. Monzo"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Account Type</label>
                  <input
                    type="text"
                    value={row.type}
                    onChange={(e) => update(row.id, 'type', e.target.value)}
                    placeholder="e.g. Easy Access Savings"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Current Balance</label>
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

                {/* Interest rate toggle + field */}
                <div>
                  <label className="label">Interest Rate</label>
                  {row._hasInterest ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={row.interestRate ?? ''}
                          onChange={(e) => update(row.id, 'interestRate', e.target.value)}
                          className="input-field pr-10"
                          min="0"
                          max="20"
                          step="0.01"
                          placeholder="4.75"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                          %
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleInterest(row.id)}
                        className="text-xs text-text-muted hover:text-red-400 transition-colors px-2 border border-white/10 rounded-lg"
                        title="Remove interest rate"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleInterest(row.id)}
                      className="w-full input-field text-left text-text-muted text-sm hover:border-gold/40 hover:text-gold transition-colors"
                    >
                      + Add interest rate
                    </button>
                  )}
                </div>
              </div>

              {/* Interest preview */}
              {row._hasInterest && row.interestRate && Number(row.interestRate) > 0 && (
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-text-muted">Annual interest at {row.interestRate}% AER</span>
                  <span className="text-green-400 font-playfair">
                    +£{Math.round(Number(row.value) * (Number(row.interestRate) / 100)).toLocaleString('en-GB')}
                  </span>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addAccount}
            className="w-full py-3 rounded-xl border border-dashed border-white/10 text-text-muted text-sm hover:border-gold/40 hover:text-gold transition-colors"
          >
            + Add Account
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
              {saving ? 'Saving…' : 'Save Accounts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
