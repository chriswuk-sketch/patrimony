'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'

const ManageHpiModal = dynamic(() => import('./ManageHpiModal'), { ssr: false })

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt    = (n) => '£' + Math.round(Math.abs(n)).toLocaleString('en-GB')
const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtMonth(yyyymm) {
  const [y, m] = yyyymm.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function addMonths(yyyymm, n) {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const CACHE_VERSION = 'v1'
const CACHE_TTL = 24 * 60 * 60 * 1000

function cacheKey(la, type) { return `hpi_${CACHE_VERSION}_${la}_${type}` }

function readCache(la, type) {
  try {
    const raw = localStorage.getItem(cacheKey(la, type))
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch { return null }
}

function writeCache(la, type, data) {
  try {
    localStorage.setItem(cacheKey(la, type), JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

// ── Chart data builders ───────────────────────────────────────────────────────

function buildChartData(hpiData, purchasePrice, purchaseDate, growthRateOverride, applyOverrideToHistory) {
  if (!hpiData || hpiData.length < 6) return null

  const purchaseEntry = hpiData.find(d => d.month >= purchaseDate) ?? hpiData[0]
  const hpiBase = purchaseEntry.index

  const fromPurchase = hpiData.filter(d => d.month >= purchaseDate)
  if (fromPurchase.length < 2) return null

  // Compute growth rates first — needed for both history override and projection
  const last13  = hpiData.slice(-Math.min(13, hpiData.length))
  const nMonths = last13.length - 1
  const hpiAnnualGrowth = nMonths > 0
    ? Math.pow(last13[last13.length - 1].index / last13[0].index, 12 / nMonths) - 1
    : 0.03

  const annualGrowth  = growthRateOverride != null ? growthRateOverride / 100 : hpiAnnualGrowth
  const monthlyGrowth = Math.pow(1 + annualGrowth, 1 / 12) - 1

  const [purchaseYear, purchaseMonth] = purchaseDate.split('-').map(Number)

  const useOverrideHistory = growthRateOverride != null && applyOverrideToHistory

  const historical = fromPurchase.map(d => {
    let value
    if (useOverrideHistory) {
      const [dy, dm] = d.month.split('-').map(Number)
      const monthsElapsed = (dy - purchaseYear) * 12 + (dm - purchaseMonth)
      value = Math.round(purchasePrice * Math.pow(1 + monthlyGrowth, monthsElapsed))
    } else {
      value = Math.round(purchasePrice * d.index / hpiBase)
    }
    return { month: d.month, label: fmtMonth(d.month), value, projection: undefined, projLow: undefined, sdBand: undefined }
  })

  // SD band always uses HPI historical volatility regardless of override
  const last37 = hpiData.slice(-Math.min(37, hpiData.length))
  const returns = []
  for (let i = 1; i < last37.length; i++) {
    returns.push(last37[i].index / last37[i - 1].index - 1)
  }
  const mean     = returns.reduce((s, r) => s + r, 0) / (returns.length || 1)
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length || 1)
  const monthlySD = Math.sqrt(Math.max(variance, 0))

  const latestEntry = fromPurchase[fromPurchase.length - 1]
  const latestValue = useOverrideHistory
    ? historical[historical.length - 1].value
    : Math.round(purchasePrice * latestEntry.index / hpiBase)
  const latestMonth = latestEntry.month

  const projection = []
  for (let m = 1; m <= 12; m++) {
    const month   = addMonths(latestMonth, m)
    const projVal = Math.round(latestValue * Math.pow(1 + monthlyGrowth, m))
    const sdHalf  = Math.round(latestValue * monthlySD * Math.sqrt(m))
    projection.push({
      month,
      label:      fmtMonth(month),
      value:      undefined,
      projection: projVal,
      projLow:    Math.max(projVal - sdHalf, 0),
      sdBand:     sdHalf * 2,
    })
  }

  return {
    chartData: [...historical, ...projection],
    stats: {
      purchasePrice,
      currentValue:   latestValue,
      latestMonth,
      gain:           latestValue - purchasePrice,
      gainPct:        (latestValue - purchasePrice) / purchasePrice * 100,
      annualGrowth:   annualGrowth * 100,
      hpiAnnualGrowth: hpiAnnualGrowth * 100,
      usingOverride:  growthRateOverride != null,
    },
  }
}

function buildEquityData(hpiData, purchasePrice, purchaseDate, deposit, interestRate, mortgageTerm, growthRateOverride) {
  if (!hpiData || deposit == null || !interestRate || !mortgageTerm) return null
  const loanAmount = purchasePrice - deposit
  if (loanAmount <= 0) return null

  const monthlyRate = interestRate / 100 / 12
  const n = mortgageTerm * 12
  const monthlyPayment = monthlyRate === 0
    ? loanAmount / n
    : loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n) / (Math.pow(1 + monthlyRate, n) - 1)

  const purchaseEntry = hpiData.find(d => d.month >= purchaseDate) ?? hpiData[0]
  const hpiBase = purchaseEntry.index
  const fromPurchase = hpiData.filter(d => d.month >= purchaseDate)

  const [purchaseYear, purchaseMonth] = purchaseDate.split('-').map(Number)
  const useOverride = growthRateOverride != null
  const monthlyGrowth = useOverride
    ? Math.pow(1 + growthRateOverride / 100, 1 / 12) - 1
    : null

  const equityData = fromPurchase.map((d, i) => {
    let balance
    if (monthlyRate === 0) {
      balance = Math.max(0, loanAmount - monthlyPayment * i)
    } else {
      balance = loanAmount * Math.pow(1 + monthlyRate, i)
        - monthlyPayment * (Math.pow(1 + monthlyRate, i) - 1) / monthlyRate
      balance = Math.max(0, balance)
    }
    const capitalRepaid  = Math.round(loanAmount - balance)
    let estimatedValue
    if (useOverride) {
      const [dy, dm] = d.month.split('-').map(Number)
      const monthsElapsed = (dy - purchaseYear) * 12 + (dm - purchaseMonth)
      estimatedValue = Math.round(purchasePrice * Math.pow(1 + monthlyGrowth, monthsElapsed))
    } else {
      estimatedValue = Math.round(purchasePrice * d.index / hpiBase)
    }
    const priceChange    = estimatedValue - purchasePrice

    return {
      month: d.month,
      label: fmtMonth(d.month),
      deposit,
      capitalRepaid,
      priceGain:   Math.max(0, priceChange),  // clamped for stacking
      priceChange,                              // actual value for tooltip/stats
    }
  })

  if (!equityData.length) return null
  const latest = equityData[equityData.length - 1]
  return {
    equityData,
    equityStats: {
      capitalRepaid: latest.capitalRepaid,
      priceChange:   latest.priceChange,
      totalEquity:   deposit + latest.capitalRepaid + latest.priceChange,
    },
  }
}

// Standalone mortgage maths — no HPI data required
function buildMortgageSummary(purchasePrice, purchaseDate, deposit, interestRate, mortgageTerm) {
  if (!deposit || !interestRate || !mortgageTerm) return null
  const loanAmount = purchasePrice - deposit
  if (loanAmount <= 0) return null

  const monthlyRate    = interestRate / 100 / 12
  const n              = mortgageTerm * 12
  const monthlyPayment = monthlyRate === 0
    ? loanAmount / n
    : loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n) / (Math.pow(1 + monthlyRate, n) - 1)

  // Months elapsed since purchase
  const today = todayMonth()
  const [py, pm] = purchaseDate.split('-').map(Number)
  const [ty, tm] = today.split('-').map(Number)
  const monthsElapsed = Math.max(0, (ty - py) * 12 + (tm - pm))

  const getBalance = (m) => {
    if (monthlyRate === 0) return Math.max(0, loanAmount - monthlyPayment * m)
    const b = loanAmount * Math.pow(1 + monthlyRate, m)
      - monthlyPayment * (Math.pow(1 + monthlyRate, m) - 1) / monthlyRate
    return Math.max(0, b)
  }

  const outstanding = getBalance(monthsElapsed)
  return {
    monthlyPayment:    Math.round(monthlyPayment),
    capitalRepaid:     Math.round(loanAmount - outstanding),
    outstandingBalance: Math.round(outstanding),
    loanAmount:        Math.round(loanAmount),
  }
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

function HpiTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const hist = payload.find(p => p.dataKey === 'value')
  const proj = payload.find(p => p.dataKey === 'projection')
  const band = payload.find(p => p.dataKey === 'sdBand')
  const low  = payload.find(p => p.dataKey === 'projLow')
  const val  = hist?.value ?? proj?.value
  if (val == null) return null
  const upper = low?.value != null && band?.value != null ? low.value + band.value : null
  const lower = low?.value ?? null
  return (
    <div className="bg-card-dark border border-card-border rounded-lg px-3 py-2 text-sm min-w-[170px]">
      <p className="text-text-muted mb-2 text-xs">{label}</p>
      <p className="text-gold font-playfair font-semibold">{fmt(val)}</p>
      {proj && upper != null && (
        <p className="text-text-muted text-xs mt-0.5">Range: {fmt(lower)} – {fmt(upper)}</p>
      )}
      {proj && <p className="text-text-muted text-xs mt-0.5 italic">Projected</p>}
    </div>
  )
}

function EquityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  const totalEquity = point.deposit + point.capitalRepaid + point.priceChange
  return (
    <div className="bg-card-dark border border-card-border rounded-lg px-3 py-2 text-sm min-w-[200px]">
      <p className="text-text-muted mb-2 text-xs">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-text-muted text-xs">Deposit</span>
          <span className="text-text-primary text-xs">{fmt(point.deposit)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs" style={{ color: '#4c8ec9' }}>Capital repaid</span>
          <span className="text-text-primary text-xs">{fmt(point.capitalRepaid)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs" style={{ color: point.priceChange >= 0 ? '#4cc97a' : '#ef4444' }}>
            Price {point.priceChange >= 0 ? 'gain' : 'loss'}
          </span>
          <span className={`text-xs ${point.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {point.priceChange >= 0 ? '+' : '−'}{fmt(point.priceChange)}
          </span>
        </div>
        <div className="border-t border-white/5 mt-1.5 pt-1.5 flex justify-between gap-4">
          <span className="text-text-muted text-xs font-semibold">Total equity</span>
          <span className="text-gold text-xs font-semibold">{fmt(totalEquity)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PropertyTab({ wealth, onWealthUpdate }) {
  const residence = wealth?.property?.primaryResidence ?? {}
  const {
    purchasePrice, purchaseDate, localAuthority, propertyType,
    tenure, leaseYearsRemaining, bedrooms,
    deposit, interestRate, mortgageTerm,
    growthRateOverride,
  } = residence

  const isConfigured        = !!(purchasePrice && purchaseDate && localAuthority)
  const isMortgageConfigured = !!(deposit && interestRate && mortgageTerm)
  const bedroomsLabel       = bedrooms ? `${bedrooms >= 4 ? '4+' : bedrooms} bed` : null

  const [hpiRaw,                setHpiRaw]                = useState(null)
  const [loading,               setLoading]               = useState(false)
  const [fetchError,            setFetchError]            = useState(null)
  const [usedFallback,          setUsedFallback]          = useState(false)
  const [showSettings,          setShowSettings]          = useState(false)
  const [applyOverrideToHistory, setApplyOverrideToHistory] = useState(false)

  const fetchHpi = useCallback(async () => {
    if (!isConfigured) return
    setFetchError(null)

    const cached = readCache(localAuthority, propertyType)
    if (cached) { setHpiRaw(cached); return }

    setLoading(true)
    try {
      const from   = addMonths(purchaseDate, -3)
      const params = new URLSearchParams({ la: localAuthority, type: propertyType ?? '', from })
      const res    = await fetch(`/api/hpi?${params}`)
      const json   = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unknown error')
      setHpiRaw(json.data)
      setUsedFallback(json.usedFallback)
      writeCache(localAuthority, propertyType, json.data)
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isConfigured, localAuthority, propertyType, purchaseDate])

  useEffect(() => { fetchHpi() }, [fetchHpi])

  const result = useMemo(
    () => (hpiRaw && purchasePrice && purchaseDate)
      ? buildChartData(
          hpiRaw, Number(purchasePrice), purchaseDate,
          growthRateOverride != null ? Number(growthRateOverride) : null,
          applyOverrideToHistory
        )
      : null,
    [hpiRaw, purchasePrice, purchaseDate, growthRateOverride, applyOverrideToHistory]
  )

  const mortgageSummary = useMemo(
    () => isMortgageConfigured
      ? buildMortgageSummary(
          Number(purchasePrice), purchaseDate,
          Number(deposit), Number(interestRate), Number(mortgageTerm)
        )
      : null,
    [purchasePrice, purchaseDate, deposit, interestRate, mortgageTerm, isMortgageConfigured]
  )

  const equityResult = useMemo(
    () => (hpiRaw && purchasePrice && purchaseDate && isMortgageConfigured)
      ? buildEquityData(
          hpiRaw,
          Number(purchasePrice), purchaseDate,
          Number(deposit), Number(interestRate), Number(mortgageTerm),
          growthRateOverride != null ? Number(growthRateOverride) : null
        )
      : null,
    [hpiRaw, purchasePrice, purchaseDate, deposit, interestRate, mortgageTerm, isMortgageConfigured, growthRateOverride]
  )

  // ── Leasehold warning ─────────────────────────────────────────────────────
  const today = todayMonth()
  const leaseWarnMonth = useMemo(() => {
    if (tenure !== 'leasehold' || leaseYearsRemaining == null) return null
    const yearsUntil90 = Number(leaseYearsRemaining) - 90
    if (yearsUntil90 > 1) return null
    if (yearsUntil90 < -0.1) return 'already'
    return addMonths(today, Math.round(yearsUntil90 * 12))
  }, [tenure, leaseYearsRemaining, today])

  // ── Chart axis helpers ────────────────────────────────────────────────────
  const { chartData, stats } = result ?? { chartData: [], stats: null }

  const yearTicks       = chartData.filter(d => d.month?.endsWith('-01')).map(d => d.label)
  const todayLabel      = chartData.find(d => d.month === today)?.label
  const equityYearTicks = (equityResult?.equityData ?? []).filter(d => d.month?.endsWith('-01')).map(d => d.label)

  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto']
    const vals = chartData.flatMap(d => [
      d.value,
      d.projection,
      d.projLow != null && d.sdBand != null ? d.projLow + d.sdBand : null,
    ]).filter(v => v != null)
    if (!vals.length) return ['auto', 'auto']
    return [
      (min) => Math.floor(min * 0.93),
      (max) => Math.ceil(max * 1.05),
    ]
  }, [chartData])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Empty state */}
      {!isConfigured && (
        <div className="card py-16 text-center space-y-4">
          <p className="text-4xl">🏠</p>
          <div>
            <p className="text-text-primary font-playfair text-xl mb-1">Track your property value</p>
            <p className="text-text-muted text-sm max-w-sm mx-auto">
              Enter your purchase details and Patrimony will estimate your property's current value
              using Land Registry House Price Index data.
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="bg-gold hover:bg-gold-light text-bg-dark text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            Set up property tracking
          </button>
        </div>
      )}

      {/* Configured */}
      {isConfigured && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-text-muted text-xs uppercase tracking-widest">
              {residence.address || localAuthority}
              {bedroomsLabel && ` · ${bedroomsLabel}`}
              {' · '}<span className="capitalize">{propertyType}</span>
              {tenure === 'leasehold' && leaseYearsRemaining && (
                <span> · Leasehold {leaseYearsRemaining} yrs</span>
              )}
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs text-text-muted hover:text-gold transition-colors flex items-center gap-1"
            >
              <span>⚙</span> Settings
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="card py-16 text-center">
              <p className="text-text-muted text-sm animate-pulse">
                Fetching Land Registry HPI data for {localAuthority}…
              </p>
              <p className="text-text-muted text-xs mt-2 opacity-60">
                The Land Registry service can take up to 30 seconds
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && fetchError && (
            <div className="card py-10 text-center space-y-3">
              <p className="text-red-400 text-sm">{fetchError}</p>
              <p className="text-text-muted text-xs max-w-xs mx-auto">
                If this is a smaller district, try searching for the county (e.g. "Essex" instead of "Brentwood").
              </p>
              <button
                onClick={fetchHpi}
                className="text-xs text-gold hover:text-gold-light transition-colors border border-gold/30 hover:border-gold/60 rounded-lg px-4 py-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* HPI data fetched but doesn't cover purchase date yet */}
          {!loading && !fetchError && hpiRaw?.length > 0 && !result && (
            <div className="card py-10 text-center space-y-3">
              <p className="text-text-muted text-sm">
                No HPI data available from your purchase date yet.
              </p>
              <p className="text-text-muted text-xs max-w-sm mx-auto opacity-70">
                Land Registry data typically lags by 2–3 months. If your purchase date is recent, check back soon — or verify the date in Settings.
              </p>
              <button
                onClick={() => setShowSettings(true)}
                className="text-xs text-gold hover:text-gold-light transition-colors border border-gold/30 hover:border-gold/60 rounded-lg px-4 py-2"
              >
                Check Settings
              </button>
            </div>
          )}

          {/* Mortgage summary — shown when mortgage configured but no HPI data yet */}
          {!loading && !stats && mortgageSummary && (
            <div className="space-y-4">
              <p className="text-text-muted text-xs uppercase tracking-widest">Mortgage</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                  <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Monthly Payment</p>
                  <p className="font-playfair text-2xl font-bold text-text-primary">{fmt(mortgageSummary.monthlyPayment)}</p>
                  <p className="text-text-muted text-xs mt-1">{interestRate}% over {mortgageTerm} yrs</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Capital Repaid</p>
                  <p className="font-playfair text-2xl font-bold text-blue-400">
                    {mortgageSummary.capitalRepaid > 0 ? `+${fmt(mortgageSummary.capitalRepaid)}` : '—'}
                  </p>
                  <p className="text-text-muted text-xs mt-1">since {fmtMonth(purchaseDate)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Outstanding</p>
                  <p className="font-playfair text-2xl font-bold text-text-primary">{fmt(mortgageSummary.outstandingBalance)}</p>
                  <p className="text-text-muted text-xs mt-1">of {fmt(mortgageSummary.loanAmount)} borrowed</p>
                </div>
              </div>
            </div>
          )}

          {/* Loaded */}
          {!loading && !fetchError && stats && (
            <>
              {/* Fallback notice */}
              {usedFallback && (
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-400">
                  Insufficient data for {propertyType} properties in {localAuthority} — showing the all-property-types index instead.
                </div>
              )}

              {/* Lease warning */}
              {leaseWarnMonth && (
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-400">
                  ⚠{' '}
                  {leaseWarnMonth === 'already'
                    ? `Your lease is already below 90 years (${leaseYearsRemaining} remaining). This may affect mortgage eligibility and value.`
                    : `Your lease will fall below 90 years around ${fmtMonth(leaseWarnMonth)}. Consider extending — leases under 90 years can be harder to mortgage.`}
                </div>
              )}

              {/* Value stat cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                  <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Purchase Price</p>
                  <p className="font-playfair text-2xl font-bold text-text-primary">{fmt(stats.purchasePrice)}</p>
                  <p className="text-text-muted text-xs mt-1">{purchaseDate ? fmtMonth(purchaseDate.slice(0, 7)) : '—'}</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Current Estimate</p>
                  <p className="font-playfair text-2xl font-bold text-gold">{fmt(stats.currentValue)}</p>
                  <p className="text-text-muted text-xs mt-1">as at {fmtMonth(stats.latestMonth)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Estimated Gain</p>
                  <p className={`font-playfair text-2xl font-bold ${stats.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.gain >= 0 ? '+' : '−'}{fmt(stats.gain)}
                  </p>
                  <p className={`text-xs mt-1 ${stats.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtPct(stats.gainPct)}
                  </p>
                </div>
              </div>

              {/* HPI value chart */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-text-muted text-xs uppercase tracking-widest">
                      Estimated Value — {fmtMonth(purchaseDate)} to present + 12-month projection
                    </p>
                    <p className="text-text-muted text-xs mt-0.5 opacity-60">
                      Projection:{' '}
                      {stats.usingOverride
                        ? <span className="text-gold opacity-100">{stats.annualGrowth.toFixed(1)}%/yr (custom)</span>
                        : <span>{stats.annualGrowth.toFixed(1)}%/yr (LR trailing 12-month)</span>
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-gold inline-block rounded" />
                      Historical
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 inline-block rounded opacity-60" style={{ borderTop: '1.5px dashed #c9a84c' }} />
                      Projection
                    </span>
                    {stats.usingOverride && (
                      <button
                        onClick={() => setApplyOverrideToHistory(v => !v)}
                        className={`px-2 py-1 rounded border transition-colors ${
                          applyOverrideToHistory
                            ? 'border-gold text-gold bg-gold/5'
                            : 'border-white/10 text-text-muted hover:border-white/20'
                        }`}
                      >
                        Apply to history
                      </button>
                    )}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="histPropGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#c9a84c" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#c9a84c" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ffffff07" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#8a8070', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      ticks={yearTicks} interval={0}
                    />
                    <YAxis
                      tick={{ fill: '#8a8070', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                      width={55} domain={yDomain}
                    />
                    <Tooltip content={<HpiTooltip />} />
                    <Area type="monotone" dataKey="projLow"     fillOpacity={0}    stroke="none"   stackId="band" dot={false} activeDot={false} legendType="none" />
                    <Area type="monotone" dataKey="sdBand"      fill="#c9a84c" fillOpacity={0.1}   stroke="none"   stackId="band" dot={false} activeDot={false} legendType="none" />
                    <Area type="monotone" dataKey="value"       stroke="#c9a84c" strokeWidth={2}   fill="url(#histPropGrad)" dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="projection"  stroke="#c9a84c" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 4, fill: '#c9a84c' }} connectNulls={false} />
                    <ReferenceLine
                      y={stats.purchasePrice} stroke="#4c8ec9" strokeDasharray="4 4" strokeOpacity={0.5}
                      label={{ value: 'Purchase price', fill: '#4c8ec9', fontSize: 10, position: 'right', opacity: 0.7 }}
                    />
                    {todayLabel && (
                      <ReferenceLine
                        x={todayLabel} stroke="#ffffff" strokeOpacity={0.1} strokeDasharray="3 3"
                        label={{ value: 'Today', fill: '#8a8070', fontSize: 10, position: 'top' }}
                      />
                    )}
                    {leaseWarnMonth && leaseWarnMonth !== 'already' && (
                      <ReferenceLine
                        x={fmtMonth(leaseWarnMonth)} stroke="#f59e0b" strokeOpacity={0.5} strokeDasharray="4 3"
                        label={{ value: 'Lease < 90 yrs', fill: '#f59e0b', fontSize: 10, position: 'top', opacity: 0.7 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* ── Equity Breakdown ─────────────────────────────────────── */}
              {equityResult ? (
                <>
                  <p className="text-text-muted text-xs uppercase tracking-widest pt-2">Equity Breakdown</p>

                  {/* Equity stat cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="card text-center">
                      <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Capital Repaid</p>
                      <p className="font-playfair text-2xl font-bold text-blue-400">
                        +{fmt(equityResult.equityStats.capitalRepaid)}
                      </p>
                      <p className="text-text-muted text-xs mt-1">mortgage paid down</p>
                    </div>
                    <div className="card text-center">
                      <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Price Gain</p>
                      <p className={`font-playfair text-2xl font-bold ${equityResult.equityStats.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {equityResult.equityStats.priceChange >= 0 ? '+' : '−'}{fmt(equityResult.equityStats.priceChange)}
                      </p>
                      <p className="text-text-muted text-xs mt-1">{stats.usingOverride ? 'custom rate appreciation' : 'HPI-based appreciation'}</p>
                    </div>
                    <div className="card text-center">
                      <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Total Equity</p>
                      <p className="font-playfair text-2xl font-bold text-gold">
                        {fmt(equityResult.equityStats.totalEquity)}
                      </p>
                      <p className="text-text-muted text-xs mt-1">inc. {fmt(Number(deposit))} deposit</p>
                    </div>
                  </div>

                  {/* Equity stacked area chart */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-text-muted text-xs uppercase tracking-widest">
                        Equity Components — since purchase
                      </p>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#6b7280', opacity: 0.7 }} />
                          Deposit
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#4c8ec9', opacity: 0.8 }} />
                          Capital Repaid
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#4cc97a', opacity: 0.8 }} />
                          Price Gain
                        </span>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={equityResult.equityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid stroke="#ffffff07" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: '#8a8070', fontSize: 10 }}
                          axisLine={false} tickLine={false}
                          ticks={equityYearTicks} interval={0}
                        />
                        <YAxis
                          tick={{ fill: '#8a8070', fontSize: 10 }}
                          axisLine={false} tickLine={false}
                          tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                          width={55}
                        />
                        <Tooltip content={<EquityTooltip />} />
                        <Area type="monotone" dataKey="deposit"       stackId="equity" fill="#6b7280" fillOpacity={0.5}  stroke="none" />
                        <Area type="monotone" dataKey="capitalRepaid" stackId="equity" fill="#4c8ec9" fillOpacity={0.65} stroke="none" />
                        <Area type="monotone" dataKey="priceGain"     stackId="equity" fill="#4cc97a" fillOpacity={0.65} stroke="none" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : !isMortgageConfigured && (
                <div className="card py-8 text-center space-y-2">
                  <p className="text-text-muted text-sm">Add your mortgage details in Settings to see equity breakdown</p>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="text-xs text-gold hover:text-gold-light transition-colors"
                  >
                    Open Settings →
                  </button>
                </div>
              )}

              {/* Footer */}
              <div className="card-sm flex items-start gap-3">
                <span className="text-gold text-lg mt-0.5">ℹ</span>
                <div className="text-text-muted text-xs leading-relaxed space-y-1">
                  <p>
                    Estimated value = <span className="text-text-primary">purchase price × (HPI<sub>now</sub> / HPI<sub>purchase</sub>)</span> using the Land Registry House Price Index for <span className="text-text-primary">{localAuthority}</span>.
                    {stats.usingOverride
                      ? <> The projection uses your custom rate of <span className="text-text-primary">{stats.annualGrowth.toFixed(1)}%/yr</span> (LR trailing rate is {stats.hpiAnnualGrowth.toFixed(1)}%/yr). The shaded band shows ±1 SD based on 36 months of historical LR volatility.</>
                      : <> The projection uses the trailing 12-month LR growth rate of <span className="text-text-primary">{stats.annualGrowth.toFixed(1)}%/yr</span>; the shaded band shows ±1 SD based on 36 months of monthly returns. Override this in Settings.</>
                    }
                  </p>
                  {isMortgageConfigured && (
                    <p>
                      Equity breakdown assumes a repayment mortgage at <span className="text-text-primary">{interestRate}%</span> over <span className="text-text-primary">{mortgageTerm} years</span> on a loan of <span className="text-text-primary">{fmt(Number(purchasePrice) - Number(deposit))}</span>.
                    </p>
                  )}
                  <p className="opacity-60">
                    Land Registry data typically lags by ~2 months. These are estimates only — not professional valuations.
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {showSettings && (
        <ManageHpiModal
          residence={residence}
          onClose={() => setShowSettings(false)}
          onSaved={(updated) => {
            const newRes = updated?.property?.primaryResidence ?? {}
            // Only clear cached HPI data if the local authority or property type changed
            if (newRes.localAuthority !== localAuthority || newRes.propertyType !== propertyType) {
              setHpiRaw(null)
            }
            onWealthUpdate?.(updated)
            setShowSettings(false)
          }}
        />
      )}
    </div>
  )
}
