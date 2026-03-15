'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

const OverviewTab = dynamic(() => import('@/components/OverviewTab'), { ssr: false })
const AccountsTab = dynamic(() => import('@/components/AccountsTab'), { ssr: false })
const PensionTab = dynamic(() => import('@/components/PensionTab'), { ssr: false })
const BudgetTab = dynamic(() => import('@/components/BudgetTab'), { ssr: false })
const PropertyTab = dynamic(() => import('@/components/PropertyTab'), { ssr: false })
const UpdateModal = dynamic(() => import('@/components/UpdateModal'), { ssr: false })

const TABS = ['Overview', 'Accounts', 'Pension', 'Budget', 'Property']

function fmt(n) {
  return '£' + Math.round(n).toLocaleString('en-GB')
}

function computeNetWorth(wealth) {
  if (!wealth) return 0
  const cashTotal = wealth.cash.accounts.reduce((s, a) => s + a.value, 0)
  const isaTotal = wealth.isa.holdings.reduce((s, h) => s + h.value, 0)
  const pensionTotal = wealth.pension.holdings.reduce((s, h) => s + h.value, 0)
  const assets =
    cashTotal +
    isaTotal +
    wealth.property.primaryResidence.estimatedValue +
    pensionTotal
  return assets - wealth.liabilities.mortgage.balance
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [wealth, setWealth] = useState(null)
  const [history, setHistory] = useState(null)
  const [budget, setBudget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [wealthRes, historyRes, budgetRes] = await Promise.all([
        fetch('/api/wealth'),
        fetch('/api/history'),
        fetch('/api/budget'),
      ])
      const [wealthData, historyData, budgetData] = await Promise.all([
        wealthRes.json(),
        historyRes.json(),
        budgetRes.json(),
      ])
      setWealth(wealthData)
      setHistory(historyData)
      setBudget(budgetData)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaved = (updatedWealth) => {
    setWealth(updatedWealth)
  }

  const lastUpdated = wealth?.lastUpdated
    ? new Date(wealth.lastUpdated).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  const netWorth = computeNetWorth(wealth)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-center">
          <p className="font-playfair text-gold text-3xl mb-2">Patrimony</p>
          <p className="text-text-muted text-sm animate-pulse">Loading your wealth data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-dark">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-bg-dark/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex-shrink-0">
            <h1 className="font-playfair text-xl text-gold leading-none">Patrimony</h1>
            <p className="text-text-muted text-xs uppercase tracking-widest leading-none mt-0.5">
              Personal Wealth Dashboard
            </p>
          </div>

          {/* Net worth pill (desktop) */}
          <div className="hidden md:block text-center">
            <p className="text-text-muted text-xs uppercase tracking-widest leading-none">Net Worth</p>
            <p className="font-playfair text-gold font-bold text-lg leading-tight">{fmt(netWorth)}</p>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-text-muted text-xs uppercase tracking-wide leading-none">
                Last updated
              </p>
              <p className="text-text-primary text-xs mt-0.5">{lastUpdated}</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gold hover:bg-gold-light text-bg-dark text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              + Monthly Update
            </button>
          </div>
        </div>
      </nav>

      {/* Tab bar */}
      <div className="border-b border-white/5 bg-bg-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? 'tab-btn-active' : 'tab-btn-inactive'}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'Overview' && (
          <OverviewTab wealth={wealth} history={history} onHistoryUpdate={setHistory} />
        )}
        {activeTab === 'Accounts' && (
          <AccountsTab wealth={wealth} onWealthUpdate={handleSaved} />
        )}
        {activeTab === 'Pension' && (
          <PensionTab wealth={wealth} />
        )}
        {activeTab === 'Budget' && (
          <BudgetTab budget={budget} onBudgetUpdate={setBudget} />
        )}
        {activeTab === 'Property' && (
          <PropertyTab wealth={wealth} onWealthUpdate={handleSaved} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <p className="text-text-muted text-xs">
            <span className="font-playfair text-gold">Patrimony</span> — Private &amp; local. No data leaves your device.
          </p>
          <p className="text-text-muted text-xs hidden sm:block">
            Data stored in <code className="text-gold/70">/data/wealth.json</code>
          </p>
        </div>
      </footer>

      {/* Update Modal */}
      {showModal && (
        <UpdateModal
          wealth={wealth}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
