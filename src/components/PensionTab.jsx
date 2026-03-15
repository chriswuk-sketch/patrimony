'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

const fmt   = (n) => '£' + Math.round(n).toLocaleString('en-GB')
const INFLATION = 0.02

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  const nominal = payload.find(p => p.dataKey === 'value')
  const real    = payload.find(p => p.dataKey === 'realValue')
  return (
    <div className="bg-card-dark border border-card-border rounded-lg px-3 py-2 text-sm min-w-[170px]">
      <p className="text-text-muted mb-2">Age {label}</p>
      {nominal && (
        <div className="flex justify-between gap-4 text-xs mb-0.5">
          <span className="text-gold">Nominal</span>
          <span className="text-text-primary font-mono">{fmt(nominal.value)}</span>
        </div>
      )}
      {real && (
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-blue-400">Today's money</span>
          <span className="text-text-primary font-mono">{fmt(real.value)}</span>
        </div>
      )}
    </div>
  )
}

function Slider({ label, value, min, max, step = 1, onChange, unit = '', hint }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-xs text-text-muted uppercase tracking-wide">{label}</label>
        <span className="font-playfair text-lg text-gold">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-text-muted">
        <span>{min}{unit}</span>
        {hint && <span className="text-text-muted/60 italic">{hint}</span>}
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export default function PensionTab({ wealth }) {
  const currentPot = wealth?.pension?.holdings?.reduce((s, h) => s + h.value, 0) ?? 0

  const [currentAge,       setCurrentAge]       = useState(35)
  const [retireAge,        setRetireAge]        = useState(60)
  const [growthRate,       setGrowthRate]       = useState(6)
  const [monthlyContrib,   setMonthlyContrib]   = useState(500)
  const [contribGrowthRate, setContribGrowthRate] = useState(3)

  const yearsToRetirement = Math.max(retireAge - currentAge, 0)

  // Year-by-year accumulation: contributions grow annually, pot compounds
  const chartData = useMemo(() => {
    const data = []
    let pot = currentPot
    for (let age = currentAge; age <= retireAge; age++) {
      const years = age - currentAge
      const real  = pot / Math.pow(1 + INFLATION, years)
      data.push({ age, value: Math.round(pot), realValue: Math.round(real) })
      if (age < retireAge) {
        const annualContrib = 12 * monthlyContrib * Math.pow(1 + contribGrowthRate / 100, years)
        pot = (pot + annualContrib) * (1 + growthRate / 100)
      }
    }
    return data
  }, [currentPot, currentAge, retireAge, growthRate, monthlyContrib, contribGrowthRate])

  const last            = chartData[chartData.length - 1] ?? { value: currentPot, realValue: currentPot }
  const projectedPot    = last.value
  const realPot         = last.realValue
  const realAnnualIncome = realPot / 25

  const milestones = [100000, 250000, 500000, 1000000]

  // Total contributed (nominal, for footnote)
  const totalContributed = useMemo(() => {
    let total = 0
    for (let y = 0; y < yearsToRetirement; y++) {
      total += 12 * monthlyContrib * Math.pow(1 + contribGrowthRate / 100, y)
    }
    return Math.round(total)
  }, [yearsToRetirement, monthlyContrib, contribGrowthRate])

  return (
    <div className="space-y-6">

      {/* ── Result cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center py-6">
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">
            Projected Pot at {retireAge}
          </p>
          <p className="font-playfair text-4xl font-bold text-gold mb-1">{fmt(projectedPot)}</p>
          <p className="text-text-muted text-xs">
            Nominal · {yearsToRetirement} yrs at {growthRate}% p.a.
          </p>
        </div>

        <div className="card text-center py-6 border border-blue-500/20">
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">
            In Today's Money
          </p>
          <p className="font-playfair text-4xl font-bold text-blue-400 mb-1">{fmt(realPot)}</p>
          <p className="text-text-muted text-xs">
            After 2% p.a. inflation over {yearsToRetirement} yrs
          </p>
        </div>

        <div className="card text-center py-6">
          <p className="text-text-muted text-xs uppercase tracking-widest mb-2">
            4% Rule — Annual Income
          </p>
          <p className="font-playfair text-4xl font-bold text-green-400 mb-1">
            {fmt(realAnnualIncome)}
          </p>
          <p className="text-text-muted text-xs">
            {fmt(realAnnualIncome / 12)} / month · in today's money
          </p>
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="card">
        <p className="text-text-muted text-xs uppercase tracking-widest mb-5">
          Projection Controls
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Slider
            label="Current Age"
            value={currentAge}
            min={20}
            max={70}
            onChange={(v) => {
              setCurrentAge(v)
              if (v >= retireAge) setRetireAge(v + 1)
            }}
          />
          <Slider
            label="Retire At"
            value={retireAge}
            min={currentAge + 1}
            max={80}
            onChange={setRetireAge}
          />
          <Slider
            label="Annual Growth Rate"
            value={growthRate}
            min={1}
            max={12}
            step={0.5}
            onChange={setGrowthRate}
            unit="%"
            hint="fund return"
          />
          <Slider
            label="Monthly Contribution"
            value={monthlyContrib}
            min={0}
            max={3000}
            step={50}
            onChange={setMonthlyContrib}
            unit=""
            hint="£/month"
          />
          <Slider
            label="Contributions Grow At"
            value={contribGrowthRate}
            min={0}
            max={10}
            step={0.5}
            onChange={setContribGrowthRate}
            unit="%"
            hint="per year"
          />
        </div>

        <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-text-muted">Current pot</p>
            <p className="text-text-primary font-playfair font-semibold">{fmt(currentPot)}</p>
          </div>
          <div>
            <p className="text-text-muted">Years to retire</p>
            <p className="text-text-primary font-playfair font-semibold">{yearsToRetirement} yrs</p>
          </div>
          <div>
            <p className="text-text-muted">Total contributions</p>
            <p className="text-text-primary font-playfair font-semibold">{fmt(totalContributed)}</p>
          </div>
          <div>
            <p className="text-text-muted">Growth on top</p>
            <p className="text-green-400 font-playfair font-semibold">
              {fmt(Math.max(projectedPot - currentPot - totalContributed, 0))}
            </p>
          </div>
        </div>
      </div>

      {/* ── Chart ────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-text-muted text-xs uppercase tracking-widest">
            Pension Growth — Age {currentAge} to {retireAge}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-gold inline-block rounded" />
              <span className="text-text-muted">Nominal</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-400 inline-block rounded" style={{ borderTop: '1px dashed' }} />
              <span className="text-text-muted">Today's money</span>
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pensionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#c9a84c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c9a84c" stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4c8ec9" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#4c8ec9" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="age"
              tick={{ fill: '#8a8070', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Age', position: 'insideBottom', offset: -2, fill: '#8a8070', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: '#8a8070', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            {milestones.map((m) =>
              projectedPot >= m ? (
                <ReferenceLine
                  key={m}
                  y={m}
                  stroke="#c9a84c22"
                  strokeDasharray="4 4"
                  label={{
                    value: `£${m >= 1000000 ? '1m' : m / 1000 + 'k'}`,
                    fill: '#c9a84c55',
                    fontSize: 10,
                    position: 'right',
                  }}
                />
              ) : null
            )}
            {/* Real value — rendered first so nominal sits on top */}
            <Area
              type="monotone"
              dataKey="realValue"
              stroke="#4c8ec9"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fill="url(#realGrad)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#c9a84c"
              strokeWidth={2}
              fill="url(#pensionGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Info footer ──────────────────────────────────────────────── */}
      <div className="card-sm flex items-start gap-3">
        <span className="text-gold text-lg mt-0.5">ℹ</span>
        <div className="text-text-muted text-xs leading-relaxed space-y-1.5">
          <p>
            The <strong className="text-text-primary">4% rule</strong> (Bengen, 1994) suggests withdrawing
            4% of your pot annually provides ~30 years of income — shown as{' '}
            <strong className="text-text-primary">pot ÷ 25</strong> = annual income.
          </p>
          <p>
            <strong className="text-text-primary">Today's money</strong> deflates the projected pot by{' '}
            <strong className="text-text-primary">2% per year</strong> to express future purchasing power
            in present-day terms. Income figures use the inflation-adjusted pot.
          </p>
          <p className="text-text-muted/60">
            This is illustrative — consult a regulated financial adviser for personalised retirement planning.
          </p>
        </div>
      </div>
    </div>
  )
}
