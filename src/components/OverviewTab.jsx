'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const HistoryUploadModal = dynamic(() => import('./HistoryUploadModal'), { ssr: false })

const fmt = (n) =>
  '£' + Math.round(n).toLocaleString('en-GB')

const COLORS = ['#c9a84c', '#4c8ec9', '#4cc97a', '#c94c4c', '#9b4cc9']

const STACK_COLORS = {
  property:    '#4cc97a',
  pensions:    '#c94c4c',
  investments: '#4c8ec9',
  cash:        '#c9a84c',
}

const STACK_LABELS = {
  property:    'Property',
  pensions:    'Pensions',
  investments: 'Investments',
  cash:        'Cash',
}

const StackedTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-card-dark border border-card-border rounded-lg px-3 py-2 text-sm min-w-[160px]">
      <p className="text-text-muted mb-2">{label}</p>
      {[...payload].reverse().map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4 text-xs mb-0.5">
          <span style={{ color: p.fill }}>{STACK_LABELS[p.dataKey]}</span>
          <span className="text-text-primary font-mono">{fmt(p.value)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-4 text-xs border-t border-white/10 mt-1.5 pt-1.5">
        <span className="text-text-muted">Total</span>
        <span className="text-gold font-playfair font-semibold">{fmt(total)}</span>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card-dark border border-card-border rounded-lg px-3 py-2 text-sm">
        <p className="text-text-muted mb-1">{label}</p>
        <p className="text-gold font-playfair font-semibold">{fmt(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card-dark border border-card-border rounded-lg px-3 py-2 text-sm">
        <p className="text-text-muted">{payload[0].name}</p>
        <p className="text-gold font-playfair font-semibold">{fmt(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export default function OverviewTab({ wealth, history, onHistoryUpdate }) {
  const [showUpload, setShowUpload] = useState(false)
  if (!wealth || !history) return null

  const cash = wealth.cash.accounts.reduce((s, a) => s + a.value, 0)
  const isa = wealth.isa.holdings.reduce((s, h) => s + h.value, 0)
  const propertyEquity =
    wealth.property.primaryResidence.estimatedValue -
    wealth.property.primaryResidence.mortgageBalance
  const pension = wealth.pension.holdings.reduce((s, h) => s + h.value, 0)
  const mortgage = wealth.liabilities.mortgage.balance

  const totalAssets = cash + isa + wealth.property.primaryResidence.estimatedValue + pension
  const totalLiabilities = mortgage
  const netWorth = totalAssets - totalLiabilities

  const historyData = history.history || []
  const hasBreakdown = historyData.some(
    (d) => d.cash != null || d.pensions != null || d.investments != null || d.property != null
  )
  const prev = historyData.length >= 2 ? historyData[historyData.length - 2].netWorth : netWorth
  const change = netWorth - prev
  const changePct = prev !== 0 ? (change / prev) * 100 : 0

  const pieData = [
    { name: 'Cash', value: cash },
    { name: 'ISA', value: isa },
    { name: 'Property Equity', value: propertyEquity },
    { name: 'Pension', value: pension },
  ]

  const summaryCards = [
    { label: 'Total Assets', value: fmt(totalAssets), sub: 'All holdings' },
    { label: 'Liabilities', value: fmt(totalLiabilities), sub: 'Mortgage outstanding', red: true },
    { label: 'Property Equity', value: fmt(propertyEquity), sub: 'Value minus mortgage' },
    { label: 'Liquid Cash', value: fmt(cash), sub: 'Current + savings' },
  ]

  return (
    <div className="space-y-6">
      {/* Hero net worth */}
      <div className="card text-center py-8">
        <p className="text-text-muted text-sm uppercase tracking-widest mb-2 font-dm">
          Total Net Worth
        </p>
        <p className="font-playfair text-5xl font-bold text-gold mb-3">{fmt(netWorth)}</p>
        <div
          className={`inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full ${
            change >= 0
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          <span>{change >= 0 ? '▲' : '▼'}</span>
          <span>{fmt(Math.abs(change))}</span>
          <span className="text-text-muted">({Math.abs(changePct).toFixed(1)}% MoM)</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-text-muted text-xs uppercase tracking-wide mb-1">{c.label}</p>
            <p
              className={`font-playfair text-xl font-semibold mb-1 ${
                c.red ? 'text-red-400' : 'text-text-primary'
              }`}
            >
              {c.value}
            </p>
            <p className="text-text-muted text-xs">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Net worth trend */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-text-muted text-xs uppercase tracking-widest">
              Net Worth — {historyData.length} Month Trend
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="text-xs text-text-muted hover:text-gold transition-colors flex items-center gap-1"
            >
              ↑ Upload CSV to show historical net worth
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {hasBreakdown ? (
              <AreaChart data={historyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  {Object.entries(STACK_COLORS).map(([key, color]) => (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.2} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#8a8070', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#8a8070', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                  width={50}
                />
                <Tooltip content={<StackedTooltip />} />
                {['property', 'pensions', 'investments', 'cash'].map((key) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId="1"
                    stroke={STACK_COLORS[key]}
                    strokeWidth={1}
                    fill={`url(#grad-${key})`}
                  />
                ))}
              </AreaChart>
            ) : (
              <AreaChart data={historyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9a84c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c9a84c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#8a8070', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#8a8070', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#c9a84c"
                  strokeWidth={2}
                  fill="url(#goldGrad)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Wealth breakdown donut */}
        <div className="card">
          <p className="text-text-muted text-xs uppercase tracking-widest mb-4">
            Wealth Breakdown
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#8a8070', fontSize: 11 }}>{value}</span>
                )}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {showUpload && (
        <HistoryUploadModal
          existingCount={historyData.length}
          onClose={() => setShowUpload(false)}
          onSaved={(updated) => {
            onHistoryUpdate?.(updated)
            setShowUpload(false)
          }}
        />
      )}
    </div>
  )
}
