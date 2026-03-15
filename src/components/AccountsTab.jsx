'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const ManageCashModal     = dynamic(() => import('./ManageCashModal'),     { ssr: false })
const ManageHoldingsModal = dynamic(() => import('./ManageHoldingsModal'), { ssr: false })
const ManagePropertyModal = dynamic(() => import('./ManagePropertyModal'), { ssr: false })

const fmt = (n) => '£' + Math.round(n).toLocaleString('en-GB')

const PALETTE = ['#ff6b6b', '#4cc97a', '#4c8ec9', '#c9a84c', '#9b4cc9', '#4cc9c9', '#ff9f43', '#a29bfe']
const STATIC_COLORS = {
  'Primary Home': '#c9a84c',
  Nationwide: '#9b4cc9',
}

function ColorDot({ color }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

function AccountRow({ color, institution, value, sub, red, badge }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <ColorDot color={color} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-text-primary">{institution}</p>
            {badge && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-mono whitespace-nowrap">
                {badge}
              </span>
            )}
          </div>
          {sub && <p className="text-xs text-text-muted truncate">{sub}</p>}
        </div>
      </div>
      <p className={`font-playfair font-semibold text-sm ml-3 flex-shrink-0 ${red ? 'text-red-400' : 'text-text-primary'}`}>
        {value}
      </p>
    </div>
  )
}

function LivePricePanel({ symbol, priceData, loading }) {
  if (!symbol) return null
  return (
    <div className="mt-2 p-2.5 rounded-lg bg-bg-dark border border-white/5">
      <p className="text-xs text-text-muted mb-1">Live Price — {symbol}</p>
      {loading ? (
        <p className="text-xs text-text-muted animate-pulse">Fetching…</p>
      ) : priceData && !priceData.fallback ? (
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-gold font-playfair font-semibold">
            £{priceData.price?.toFixed(2)}
          </p>
          <p className="text-text-muted text-xs">
            {priceData.shortName} ·{' '}
            {new Date(priceData.timestamp).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      ) : (
        <p className="text-xs text-text-muted">Price unavailable — using manual value</p>
      )}
    </div>
  )
}

function AssetCard({ title, children, total, totalRed, action }) {
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-text-muted text-xs uppercase tracking-widest">{title}</p>
        {action}
      </div>
      <div className="space-y-0">{children}</div>
      <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
        <p className="text-xs text-text-muted uppercase tracking-wide">Subtotal</p>
        <p className={`font-playfair font-bold ${totalRed ? 'text-red-400' : 'text-gold'}`}>
          {total}
        </p>
      </div>
    </div>
  )
}

function ManageButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-text-muted hover:text-gold transition-colors flex items-center gap-1"
    >
      <span>⚙</span> Manage
    </button>
  )
}

export default function AccountsTab({ wealth, onWealthUpdate }) {
  const [livePrices, setLivePrices] = useState({})
  const [pricesLoading, setPricesLoading] = useState(true)
  const [showManageCash,     setShowManageCash]     = useState(false)
  const [showManageIsa,      setShowManageIsa]      = useState(false)
  const [showManagePension,  setShowManagePension]  = useState(false)
  const [showManageProperty, setShowManageProperty] = useState(false)

  useEffect(() => {
    if (!wealth) return

    const symbols = new Set()
    wealth.isa.holdings.forEach((h) => h.symbol && symbols.add(h.symbol))
    wealth.pension.holdings.forEach((h) => h.symbol && symbols.add(h.symbol))

    if (symbols.size === 0) {
      setPricesLoading(false)
      return
    }

    const fetchAll = async () => {
      const results = await Promise.all(
        [...symbols].map(async (symbol) => {
          try {
            const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`)
            const data = await res.json()
            return [symbol, data]
          } catch {
            return [symbol, { fallback: true }]
          }
        })
      )
      setLivePrices(Object.fromEntries(results))
      setPricesLoading(false)
    }

    fetchAll()
  }, [wealth])

  if (!wealth) return null

  const { cash, isa, property, pension, liabilities } = wealth
  const cashAccounts = cash.accounts ?? []
  const cashTotal = cashAccounts.reduce((s, a) => s + a.value, 0)
  const annualInterest = cashAccounts.reduce(
    (s, a) => (a.interestRate ? s + a.value * (a.interestRate / 100) : s),
    0
  )

  const isaHoldings = isa.holdings ?? []
  const isaTotal = isaHoldings.reduce((s, h) => s + h.value, 0)

  const pensionHoldings = pension.holdings ?? []
  const pensionTotal = pensionHoldings.reduce((s, h) => s + h.value, 0)

  const propertyEquity =
    property.primaryResidence.estimatedValue - property.primaryResidence.mortgageBalance
  const liabilitiesTotal = liabilities.mortgage.balance

  const handleSaved = (updated) => {
    onWealthUpdate?.(updated)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Cash & Savings */}
        <AssetCard
          title="Cash & Savings"
          total={fmt(cashTotal)}
          action={<ManageButton onClick={() => setShowManageCash(true)} />}
        >
          {cashAccounts.length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">
              No accounts yet.{' '}
              <button onClick={() => setShowManageCash(true)} className="text-gold underline">
                Add one
              </button>
            </p>
          ) : (
            cashAccounts.map((account, i) => (
              <AccountRow
                key={account.id}
                color={PALETTE[i % PALETTE.length]}
                institution={account.institution}
                value={fmt(account.value)}
                sub={account.type}
                badge={account.interestRate ? `${account.interestRate}% AER` : null}
              />
            ))
          )}
          {annualInterest > 0 && (
            <div className="mt-2 p-2.5 rounded-lg bg-bg-dark border border-white/5">
              <div className="flex justify-between items-baseline">
                <p className="text-xs text-text-muted">Est. annual interest</p>
                <p className="text-green-400 font-playfair font-semibold text-sm">
                  +{fmt(annualInterest)}
                </p>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{fmt(annualInterest / 12)} / month</p>
            </div>
          )}
        </AssetCard>

        {/* ISA & Investments */}
        <AssetCard
          title="ISA & Investments"
          total={fmt(isaTotal)}
          action={<ManageButton onClick={() => setShowManageIsa(true)} />}
        >
          {isaHoldings.length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">
              No holdings yet.{' '}
              <button onClick={() => setShowManageIsa(true)} className="text-gold underline">
                Add one
              </button>
            </p>
          ) : (
            isaHoldings.map((holding, i) => (
              <div key={holding.id}>
                <AccountRow
                  color={PALETTE[i % PALETTE.length]}
                  institution={holding.institution}
                  value={fmt(holding.value)}
                  sub={[
                    holding.name,
                    holding.symbol,
                    holding.units != null ? `${holding.units.toFixed(2)} units` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <LivePricePanel
                  symbol={holding.symbol}
                  priceData={livePrices[holding.symbol]}
                  loading={pricesLoading && !!holding.symbol}
                />
              </div>
            ))
          )}
        </AssetCard>

        {/* Property */}
        <AssetCard title="Property" total={fmt(propertyEquity)} action={<ManageButton onClick={() => setShowManageProperty(true)} />}>
          <AccountRow
            color={STATIC_COLORS['Primary Home']}
            institution="Primary Home"
            value={fmt(property.primaryResidence.estimatedValue)}
            sub="Estimated value"
          />
          <AccountRow
            color={STATIC_COLORS['Nationwide']}
            institution="Nationwide"
            value={`-${fmt(liabilities.mortgage.balance)}`}
            sub="Mortgage outstanding"
            red
          />
          <div className="mt-2 pt-2 flex justify-between text-xs">
            <span className="text-text-muted">Equity</span>
            <span className="text-green-400 font-semibold">{fmt(propertyEquity)}</span>
          </div>
        </AssetCard>

        {/* Pension */}
        <AssetCard
          title="Pension"
          total={fmt(pensionTotal)}
          action={<ManageButton onClick={() => setShowManagePension(true)} />}
        >
          {pensionHoldings.length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">
              No holdings yet.{' '}
              <button onClick={() => setShowManagePension(true)} className="text-gold underline">
                Add one
              </button>
            </p>
          ) : (
            pensionHoldings.map((holding, i) => (
              <div key={holding.id}>
                <AccountRow
                  color={PALETTE[i % PALETTE.length]}
                  institution={holding.institution}
                  value={fmt(holding.value)}
                  sub={[
                    holding.name,
                    holding.symbol,
                    holding.units != null ? `${holding.units.toFixed(2)} units` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <LivePricePanel
                  symbol={holding.symbol}
                  priceData={livePrices[holding.symbol]}
                  loading={pricesLoading && !!holding.symbol}
                />
              </div>
            ))
          )}
          <div className="mt-2 p-2.5 rounded-lg bg-bg-dark border border-white/5">
            <p className="text-xs text-text-muted">
              Use the <span className="text-text-primary">Pension</span> tab to project growth to retirement.
            </p>
          </div>
        </AssetCard>
      </div>

      {/* Liabilities */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-text-muted text-xs uppercase tracking-widest">Liabilities</p>
          <ManageButton onClick={() => setShowManageProperty(true)} />
        </div>
        <AccountRow
          color={STATIC_COLORS['Nationwide']}
          institution="Nationwide"
          value={`-${fmt(liabilities.mortgage.balance)}`}
          sub={`Mortgage · £${liabilities.mortgage.monthlyPayment}/month`}
          red
        />
        <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
          <p className="text-xs text-text-muted uppercase tracking-wide">Total Liabilities</p>
          <p className="font-playfair font-bold text-red-400">{fmt(liabilitiesTotal)}</p>
        </div>
      </div>

      {showManageCash && (
        <ManageCashModal
          accounts={cashAccounts}
          onClose={() => setShowManageCash(false)}
          onSaved={(updated) => { handleSaved(updated); setShowManageCash(false) }}
        />
      )}
      {showManageIsa && (
        <ManageHoldingsModal
          holdings={isaHoldings}
          type="isa"
          title="ISA & Investments"
          onClose={() => setShowManageIsa(false)}
          onSaved={(updated) => { handleSaved(updated); setShowManageIsa(false) }}
        />
      )}
      {showManagePension && (
        <ManageHoldingsModal
          holdings={pensionHoldings}
          type="pension"
          title="Pension Holdings"
          onClose={() => setShowManagePension(false)}
          onSaved={(updated) => { handleSaved(updated); setShowManagePension(false) }}
        />
      )}
      {showManageProperty && (
        <ManagePropertyModal
          property={property}
          liabilities={liabilities}
          onClose={() => setShowManageProperty(false)}
          onSaved={(updated) => { handleSaved(updated); setShowManageProperty(false) }}
        />
      )}
    </div>
  )
}
