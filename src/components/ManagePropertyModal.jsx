'use client'

import { useState } from 'react'

export default function ManagePropertyModal({ property, liabilities, onClose, onSaved }) {
  const residence = property.primaryResidence
  const mortgage  = liabilities.mortgage

  const [propInstitution, setPropInstitution] = useState(residence.institution ?? '')
  const [propAddress,     setPropAddress]     = useState(residence.address ?? '')
  const [propValue,       setPropValue]       = useState(residence.estimatedValue ?? 0)
  const [mortInstitution, setMortInstitution] = useState(mortgage.institution ?? '')
  const [mortBalance,     setMortBalance]     = useState(mortgage.balance ?? 0)
  const [mortMonthly,     setMortMonthly]     = useState(mortgage.monthlyPayment ?? 0)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const equity = (Number(propValue) || 0) - (Number(mortBalance) || 0)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyResidence: {
            ...residence,
            institution:    propInstitution,
            address:        propAddress,
            estimatedValue: Number(propValue)    || 0,
            mortgageBalance: Number(mortBalance) || 0,
          },
          mortgageData: {
            institution:    mortInstitution,
            balance:        Number(mortBalance)  || 0,
            monthlyPayment: Number(mortMonthly)  || 0,
          },
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      onSaved(await res.json())
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
            <h2 className="font-playfair text-xl text-text-primary">Manage Property & Mortgage</h2>
            <p className="text-text-muted text-xs mt-0.5">Update your property value and outstanding mortgage</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Property section */}
          <div className="rounded-xl border border-white/5 bg-bg-dark p-4 space-y-3">
            <p className="text-xs text-text-muted uppercase tracking-widest">Property</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name / Label</label>
                <input
                  type="text"
                  value={propInstitution}
                  onChange={(e) => setPropInstitution(e.target.value)}
                  placeholder="e.g. Primary Home"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Address</label>
                <input
                  type="text"
                  value={propAddress}
                  onChange={(e) => setPropAddress(e.target.value)}
                  placeholder="e.g. London, UK"
                  className="input-field"
                />
              </div>
              <div className="col-span-2">
                <label className="label">Estimated Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
                  <input
                    type="number"
                    value={propValue}
                    onChange={(e) => setPropValue(e.target.value)}
                    className="input-field pl-7"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mortgage section */}
          <div className="rounded-xl border border-white/5 bg-bg-dark p-4 space-y-3">
            <p className="text-xs text-text-muted uppercase tracking-widest">Mortgage</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Lender</label>
                <input
                  type="text"
                  value={mortInstitution}
                  onChange={(e) => setMortInstitution(e.target.value)}
                  placeholder="e.g. Nationwide"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Monthly Payment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
                  <input
                    type="number"
                    value={mortMonthly}
                    onChange={(e) => setMortMonthly(e.target.value)}
                    className="input-field pl-7"
                    min="0"
                    step="10"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">Outstanding Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
                  <input
                    type="number"
                    value={mortBalance}
                    onChange={(e) => setMortBalance(e.target.value)}
                    className="input-field pl-7"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live equity preview */}
          <div className="flex items-center justify-between rounded-lg bg-bg-dark border border-white/5 px-4 py-3">
            <p className="text-xs text-text-muted uppercase tracking-wide">Equity preview</p>
            <p className={`font-playfair font-semibold ${equity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {equity >= 0 ? '£' : '-£'}{Math.abs(equity).toLocaleString('en-GB')}
            </p>
          </div>
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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
