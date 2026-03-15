'use client'

import { useState, useMemo } from 'react'
import { LOCAL_AUTHORITIES } from '@/lib/localAuthorities'

const PROPERTY_TYPES = [
  { value: 'flat',           label: 'Flat / Maisonette' },
  { value: 'terraced',       label: 'Terraced' },
  { value: 'semi-detached',  label: 'Semi-Detached' },
  { value: 'detached',       label: 'Detached' },
]

export default function ManageHpiModal({ residence, onClose, onSaved }) {
  const [purchasePrice,  setPurchasePrice]  = useState(residence.purchasePrice       ?? '')
  const [purchaseDate,   setPurchaseDate]   = useState(residence.purchaseDate        ?? '')
  const [localAuthority, setLocalAuthority] = useState(residence.localAuthority      ?? '')
  const [propertyType,   setPropertyType]   = useState(residence.propertyType        ?? 'flat')
  const [tenure,         setTenure]         = useState(residence.tenure              ?? 'freehold')
  const [leaseYears,     setLeaseYears]     = useState(residence.leaseYearsRemaining ?? '')
  const [bedrooms,       setBedrooms]       = useState(residence.bedrooms            ?? 2)
  const [deposit,            setDeposit]            = useState(residence.deposit             ?? '')
  const [interestRate,       setInterestRate]       = useState(residence.interestRate        ?? '')
  const [mortgageTerm,       setMortgageTerm]       = useState(residence.mortgageTerm        ?? 25)
  const [growthRateOverride, setGrowthRateOverride] = useState(residence.growthRateOverride  ?? '')
  const [laQuery,        setLaQuery]        = useState(residence.localAuthority      ?? '')
  const [laOpen,         setLaOpen]         = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')

  const filteredLAs = useMemo(() => {
    if (!laQuery.trim()) return LOCAL_AUTHORITIES.slice(0, 8)
    const q = laQuery.toLowerCase()
    return LOCAL_AUTHORITIES.filter(la => la.toLowerCase().includes(q)).slice(0, 8)
  }, [laQuery])

  const selectLA = (la) => {
    setLocalAuthority(la)
    setLaQuery(la)
    setLaOpen(false)
  }

  const handleSave = async () => {
    if (!purchasePrice || !purchaseDate || !localAuthority) {
      setError('Purchase price, date and local authority are required.')
      return
    }
    if (!/^\d{4}-\d{2}$/.test(purchaseDate)) {
      setError('Purchase date must be in YYYY-MM format, e.g. 2020-03')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyResidence: {
            ...residence,
            purchasePrice:       Number(purchasePrice) || 0,
            purchaseDate,
            localAuthority,
            propertyType,
            tenure,
            leaseYearsRemaining: tenure === 'leasehold' ? (Number(leaseYears) || null) : null,
            bedrooms:            Number(bedrooms) || 2,
            deposit:             deposit !== '' ? (Number(deposit) || null) : null,
            interestRate:        interestRate !== '' ? (Number(interestRate) || null) : null,
            mortgageTerm:        mortgageTerm !== '' ? (Number(mortgageTerm) || null) : null,
            growthRateOverride:  growthRateOverride !== '' ? (Number(growthRateOverride) || null) : null,
          },
        }),
      })
      if (!res.ok) throw new Error()
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
      <div className="bg-card-dark border border-card-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="font-playfair text-xl text-text-primary">Property Value Tracker</h2>
            <p className="text-text-muted text-xs mt-0.5">
              Set your purchase details to track estimated value using Land Registry HPI
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Purchase details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Purchase Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="285000"
                  className="input-field pl-7"
                  min="0"
                  step="1000"
                />
              </div>
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input
                type="text"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                placeholder="YYYY-MM"
                maxLength={7}
                className="input-field font-mono"
              />
              <p className="text-text-muted text-xs mt-1">e.g. 2020-03</p>
            </div>
          </div>

          {/* Local Authority */}
          <div className="relative">
            <label className="label">Local Authority</label>
            <input
              type="text"
              value={laQuery}
              onChange={(e) => { setLaQuery(e.target.value); setLocalAuthority(''); setLaOpen(true) }}
              onFocus={() => setLaOpen(true)}
              placeholder="Search e.g. Wandsworth, Camden…"
              className="input-field"
            />
            {laOpen && filteredLAs.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-card-dark border border-card-border rounded-xl shadow-xl overflow-hidden">
                {filteredLAs.map(la => (
                  <button
                    key={la}
                    onMouseDown={(e) => { e.preventDefault(); selectLA(la) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${
                      la === localAuthority ? 'text-gold' : 'text-text-primary'
                    }`}
                  >
                    {la}
                  </button>
                ))}
              </div>
            )}
            {!localAuthority && laQuery && !laOpen && (
              <p className="text-amber-400 text-xs mt-1">Select a local authority from the list.</p>
            )}
          </div>

          {/* Property Type */}
          <div>
            <label className="label mb-2">Property Type</label>
            <div className="grid grid-cols-2 gap-2">
              {PROPERTY_TYPES.map(pt => (
                <button
                  key={pt.value}
                  onClick={() => setPropertyType(pt.value)}
                  className={`py-2.5 rounded-lg border text-sm transition-colors ${
                    propertyType === pt.value
                      ? 'border-gold text-gold bg-gold/5'
                      : 'border-white/10 text-text-muted hover:border-white/20'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bedrooms */}
          <div>
            <label className="label mb-2">Bedrooms</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(b => (
                <button
                  key={b}
                  onClick={() => setBedrooms(b)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm transition-colors ${
                    bedrooms === b
                      ? 'border-gold text-gold bg-gold/5'
                      : 'border-white/10 text-text-muted hover:border-white/20'
                  }`}
                >
                  {b === 4 ? '4+' : b}
                </button>
              ))}
            </div>
          </div>

          {/* Tenure */}
          <div>
            <label className="label mb-2">Tenure</label>
            <div className="flex gap-2">
              {['freehold', 'leasehold'].map(t => (
                <button
                  key={t}
                  onClick={() => setTenure(t)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm capitalize transition-colors ${
                    tenure === t
                      ? 'border-gold text-gold bg-gold/5'
                      : 'border-white/10 text-text-muted hover:border-white/20'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Lease years (only if leasehold) */}
          {tenure === 'leasehold' && (
            <div>
              <label className="label">Lease Years Remaining</label>
              <input
                type="number"
                value={leaseYears}
                onChange={(e) => setLeaseYears(e.target.value)}
                placeholder="e.g. 95"
                className="input-field"
                min="1"
                max="999"
              />
              {Number(leaseYears) <= 90 && leaseYears !== '' && (
                <p className="text-amber-400 text-xs mt-1">
                  ⚠ Leases under 90 years can be difficult to mortgage and may reduce value.
                </p>
              )}
            </div>
          )}

          {/* Mortgage Details */}
          {/* Growth rate override */}
          <div className="border-t border-white/5 pt-5 space-y-2">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-widest mb-0.5">House Price Growth Assumption</p>
              <p className="text-text-muted text-xs opacity-60">Override the Land Registry trailing rate used in the projection</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-36">
                <input
                  type="number"
                  value={growthRateOverride}
                  onChange={(e) => setGrowthRateOverride(e.target.value)}
                  placeholder="e.g. 3.5"
                  className="input-field pr-6"
                  min="-20"
                  max="30"
                  step="0.1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
              </div>
              <p className="text-text-muted text-xs">
                per year — leave blank to use the LR trailing rate
              </p>
            </div>
            {growthRateOverride !== '' && (
              <button
                onClick={() => setGrowthRateOverride('')}
                className="text-xs text-text-muted hover:text-gold transition-colors"
              >
                ✕ Clear override
              </button>
            )}
          </div>

          <div className="border-t border-white/5 pt-5 space-y-3">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-widest mb-0.5">Mortgage Details</p>
              <p className="text-text-muted text-xs opacity-60">Optional — used to calculate equity breakdown over time</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Deposit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">£</span>
                  <input
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    placeholder="50000"
                    className="input-field pl-7"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
              <div>
                <label className="label">Interest Rate</label>
                <div className="relative">
                  <input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="4.5"
                    className="input-field pr-6"
                    min="0"
                    max="20"
                    step="0.1"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="label">Term (years)</label>
                <input
                  type="number"
                  value={mortgageTerm}
                  onChange={(e) => setMortgageTerm(e.target.value)}
                  placeholder="25"
                  className="input-field"
                  min="5"
                  max="40"
                  step="1"
                />
              </div>
            </div>
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
              {saving ? 'Saving…' : 'Save & Track'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
