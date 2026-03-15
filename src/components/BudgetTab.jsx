'use client'

import { useState, useCallback } from 'react'

const fmt = (n) => '£' + Math.round(Math.abs(n)).toLocaleString('en-GB')

const POTS = ['coreExpenses', 'savings', 'freeExpenditure']

const POT_META = {
  coreExpenses:    { label: 'Core Expenses',    color: '#c94c4c', textClass: 'text-red-400',   bgClass: 'bg-red-500/10',   borderClass: 'border-red-500/20'   },
  savings:         { label: 'Savings',          color: '#c9a84c', textClass: 'text-gold',      bgClass: 'bg-gold/10',      borderClass: 'border-gold/20'      },
  freeExpenditure: { label: 'Free Expenditure', color: '#4cc97a', textClass: 'text-green-400', bgClass: 'bg-green-500/10', borderClass: 'border-green-500/20' },
}

const DEFAULT_EXPENSES = [
  { id: '1', name: 'Housing',   amount: 1090 },
  { id: '2', name: 'Utilities', amount: 150  },
  { id: '3', name: 'Groceries', amount: 350  },
  { id: '4', name: 'Transport', amount: 200  },
  { id: '5', name: 'Insurance', amount: 80   },
  { id: '6', name: 'Phone',     amount: 40   },
]

export default function BudgetTab({ budget, onBudgetUpdate }) {
  const isNewSchema = budget?.split != null

  const [netIncome,  setNetIncome]  = useState(budget?.netIncome   ?? 4800)
  const [split,      setSplit]      = useState(budget?.split       ?? { coreExpenses: 50, savings: 20, freeExpenditure: 30 })
  const [expenses,   setExpenses]   = useState(isNewSchema ? (budget?.coreExpenses ?? DEFAULT_EXPENSES) : DEFAULT_EXPENSES)
  const [dirty,      setDirty]      = useState(false)
  const [saving,     setSaving]     = useState(false)

  const mark = useCallback(() => setDirty(true), [])

  // ── Derived values ─────────────────────────────────────────────────────────
  const income      = Number(netIncome) || 0
  const totalSplit  = POTS.reduce((s, k) => s + (Number(split[k]) || 0), 0)
  const unallocated = 100 - totalSplit
  const scale       = totalSplit > 100 ? 100 / totalSplit : 1   // shrink bar if over-allocated

  const pots = Object.fromEntries(
    POTS.map(k => [k, Math.round(income * (Number(split[k]) || 0) / 100)])
  )

  const totalExpenses  = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const coreRemaining  = pots.coreExpenses - totalExpenses

  // ── Handlers ────────────────────────────────────────────────────────────────
  const updateSplit = (key, val) => {
    setSplit(s => ({ ...s, [key]: val === '' ? '' : Number(val) || 0 }))
    mark()
  }

  const updateExpense = (id, field, val) => {
    setExpenses(es => es.map(e =>
      e.id !== id ? e : {
        ...e,
        [field]: field === 'amount' ? (val === '' ? '' : Number(val) || 0) : val
      }
    ))
    mark()
  }

  const addExpense = () => {
    setExpenses(es => [...es, { id: String(Date.now()), name: 'New item', amount: 0 }])
    mark()
  }

  const removeExpense = (id) => {
    setExpenses(es => es.filter(e => e.id !== id))
    mark()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        netIncome: income,
        split: Object.fromEntries(POTS.map(k => [k, Number(split[k]) || 0])),
        coreExpenses: expenses.map(e => ({ ...e, amount: Number(e.amount) || 0 })),
      }
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      onBudgetUpdate?.(await res.json())
      setDirty(false)
    } catch {
      // fail silently — user can retry
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Net Income ─────────────────────────────────────────────────────── */}
      <div className="card">
        <p className="text-text-muted text-xs uppercase tracking-widest mb-3">Monthly Net Income</p>
        <div className="flex items-baseline gap-2 max-w-xs">
          <span className="text-text-muted font-playfair text-2xl">£</span>
          <input
            type="number"
            min={0}
            className="input-field font-playfair text-2xl font-semibold w-40"
            value={netIncome}
            onChange={e => { setNetIncome(e.target.value); mark() }}
          />
        </div>
      </div>

      {/* ── Pot Split ──────────────────────────────────────────────────────── */}
      <div className="card space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-text-muted text-xs uppercase tracking-widest">Pot Split</p>
          {totalSplit !== 100 && (
            <span className={`text-xs px-2.5 py-0.5 rounded-full ${
              unallocated > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {unallocated > 0 ? `${unallocated}% unallocated` : `${Math.abs(unallocated)}% over-allocated`}
            </span>
          )}
          {totalSplit === 100 && (
            <span className="text-xs text-green-400">100% allocated</span>
          )}
        </div>

        {/* Three pot cards */}
        <div className="grid grid-cols-3 gap-4">
          {POTS.map(key => {
            const { label, textClass, bgClass, borderClass } = POT_META[key]
            return (
              <div key={key} className={`rounded-xl p-4 border ${bgClass} ${borderClass}`}>
                <p className={`text-xs uppercase tracking-wide mb-3 ${textClass} opacity-80`}>{label}</p>
                <div className="flex items-baseline gap-0.5 mb-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`bg-transparent font-playfair text-3xl font-bold w-16 outline-none ${textClass}`}
                    value={split[key]}
                    onChange={e => updateSplit(key, e.target.value)}
                  />
                  <span className={`text-base ${textClass}`}>%</span>
                </div>
                <p className="text-text-primary font-playfair font-semibold">
                  {fmt(pots[key])} <span className="text-text-muted text-xs font-normal font-dm">/ mo</span>
                </p>
              </div>
            )
          })}
        </div>

        {/* Proportional bar */}
        <div className="h-2.5 rounded-full overflow-hidden bg-white/5 flex">
          {POTS.map(key => {
            const w = (Number(split[key]) || 0) * scale
            return w > 0 ? (
              <div
                key={key}
                style={{ width: `${w}%`, backgroundColor: POT_META[key].color, transition: 'width 0.25s ease' }}
              />
            ) : null
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-4">
            {POTS.map(key => (
              <span key={key} style={{ color: POT_META[key].color }}>
                {POT_META[key].label} {Number(split[key]) || 0}%
              </span>
            ))}
          </div>
          <span className={totalSplit === 100 ? 'text-green-400' : 'text-text-muted'}>
            {totalSplit}% / 100%
          </span>
        </div>
      </div>

      {/* ── Core Expenses ──────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-text-muted text-xs uppercase tracking-widest">Core Expenses</p>
          <p className="text-xs text-text-muted">
            Pot: <span className="text-red-400 font-playfair font-semibold">{fmt(pots.coreExpenses)}</span>
          </p>
        </div>

        {/* Expense rows */}
        <div className="space-y-2">
          {expenses.map(expense => (
            <div key={expense.id} className="flex items-center gap-2 group">
              <input
                type="text"
                className="input-field flex-1 text-sm"
                value={expense.name}
                onChange={e => updateExpense(expense.id, 'name', e.target.value)}
              />
              <div className="relative flex items-center flex-shrink-0">
                <span className="absolute left-3 text-text-muted text-sm pointer-events-none">£</span>
                <input
                  type="number"
                  min={0}
                  className="input-field pl-7 w-28 text-sm text-right font-playfair"
                  value={expense.amount}
                  onChange={e => updateExpense(expense.id, 'amount', e.target.value)}
                />
              </div>
              <button
                onClick={() => removeExpense(expense.id)}
                className="text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 w-6 text-xl leading-none flex-shrink-0 text-center"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addExpense}
          className="text-xs text-text-muted hover:text-gold transition-colors flex items-center gap-1"
        >
          + Add expense
        </button>

        {/* Total vs pot bar */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Committed</span>
            <div className="flex items-baseline gap-2">
              <span className={`font-playfair font-semibold ${coreRemaining < 0 ? 'text-red-400' : 'text-text-primary'}`}>
                {fmt(totalExpenses)}
              </span>
              <span className={`${coreRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {coreRemaining >= 0 ? `${fmt(coreRemaining)} free` : `${fmt(Math.abs(coreRemaining))} over`}
              </span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${coreRemaining < 0 ? 'bg-red-500' : 'bg-red-400'}`}
              style={{ width: `${Math.min((totalExpenses / (pots.coreExpenses || 1)) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Your Plan ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-text-muted text-xs uppercase tracking-widest mb-3">Your Monthly Plan</p>
        <div className="grid grid-cols-3 gap-4">
          {POTS.map(key => {
            const { label, textClass, bgClass, borderClass } = POT_META[key]
            const isCore = key === 'coreExpenses'
            return (
              <div key={key} className={`card border ${borderClass}`}>
                <p className={`text-xs uppercase tracking-wide mb-1 ${textClass} opacity-80`}>{label}</p>
                <p className={`font-playfair text-2xl font-bold mb-1 ${textClass}`}>{fmt(pots[key])}</p>
                <p className="text-text-muted text-xs">{Number(split[key]) || 0}% of income</p>
                {isCore && totalExpenses > 0 && (
                  <p className={`text-xs mt-1.5 ${coreRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {coreRemaining >= 0
                      ? `${fmt(coreRemaining)} uncommitted`
                      : `${fmt(Math.abs(coreRemaining))} over budget`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Save ───────────────────────────────────────────────────────────── */}
      {dirty && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gold hover:bg-gold-light text-bg-dark text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}
