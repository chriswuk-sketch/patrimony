'use client'

import { useState, useRef } from 'react'

// ── CSV parsing helpers ─────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseMonthLabel(raw) {
  const s = raw.trim()
  if (!s) return null

  if (/^[A-Z][a-z]{2}\s+\d{4}$/.test(s)) return s

  const longMatch = s.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (longMatch) {
    const idx = MONTHS_LONG.findIndex(m => m.toLowerCase() === longMatch[1].toLowerCase())
    if (idx !== -1) return `${MONTHS_SHORT[idx]} ${longMatch[2]}`
  }

  const isoMatch = s.match(/^(\d{4})-(\d{2})/)
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-01`)
    if (!isNaN(d)) return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
  }

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const d = new Date(`${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`)
    if (!isNaN(d)) return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
  }

  const d = new Date(s)
  if (!isNaN(d)) return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`

  return null
}

function parseValue(raw) {
  if (!raw) return null
  const cleaned = raw.replace(/[£$€\s]/g, '').replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.round(n)
}

const CAT_KEYWORDS = {
  cash:        ['cash', 'liquid', 'savings', 'bank', 'current'],
  pensions:    ['pension', 'sipp', 'retirement', 'drawdown'],
  investments: ['invest', 'isa', 'stocks', 'shares', 'portfolio'],
  property:    ['property', 'house', 'home', 'real_estate', 'equity'],
}
const DATE_KW  = ['date', 'month', 'period', 'time']
const VALUE_KW = ['net_worth', 'networth', 'worth', 'value', 'amount', 'balance', 'wealth']

function detectColumns(headers) {
  let dateCol  = -1
  let valueCol = -1
  const cats   = { cash: -1, pensions: -1, investments: -1, property: -1 }

  headers.forEach((h, i) => {
    const lower = h.toLowerCase().replace(/[\s\-]+/g, '_')
    if (dateCol === -1 && DATE_KW.some(k => lower.includes(k))) dateCol = i
    for (const [cat, kws] of Object.entries(CAT_KEYWORDS)) {
      if (cats[cat] === -1 && kws.some(k => lower.includes(k))) cats[cat] = i
    }
    if (valueCol === -1 && VALUE_KW.some(k => lower.replace(/[^a-z_]/g, '').includes(k))) valueCol = i
  })

  if (dateCol === -1) dateCol = 0
  const hasBreakdown = Object.values(cats).some(c => c !== -1)
  if (!hasBreakdown && (valueCol === -1 || valueCol === dateCol)) {
    valueCol = dateCol === 0 ? 1 : 0
  }

  return { dateCol, cats, valueCol, hasBreakdown }
}

function splitCsvLine(line) {
  const fields = []
  let cur = ''
  let inQuote = false
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue }
    if (ch === ',' && !inQuote) { fields.push(cur); cur = ''; continue }
    cur += ch
  }
  fields.push(cur)
  return fields.map(f => f.trim())
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { rows: [], headers: [], hasBreakdown: false }

  const headers = splitCsvLine(lines[0])
  const { dateCol, cats, valueCol, hasBreakdown } = detectColumns(headers)

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const rawDate = cells[dateCol] ?? ''
    const month   = parseMonthLabel(rawDate)

    let row = { rawDate, month }
    let error = !month ? `Cannot parse date "${rawDate}"` : null

    if (hasBreakdown) {
      let total = 0
      for (const [cat, col] of Object.entries(cats)) {
        const val = col !== -1 ? parseValue(cells[col] ?? '') : 0
        row[cat] = val ?? 0
        total += row[cat]
      }
      row.netWorth = total
      if (!error && total === 0) error = 'All category values are zero or missing'
    } else {
      const rawValue = cells[valueCol] ?? ''
      row.rawValue  = rawValue
      row.netWorth  = parseValue(rawValue)
      if (!error && row.netWorth === null) error = `Cannot parse value "${rawValue}"`
    }

    row.error = error
    if (!month && !row.netWorth) continue
    rows.push(row)
  }

  return { rows, headers, hasBreakdown }
}

// ── Component ───────────────────────────────────────────────────────────────

const fmt = (n) => '£' + Math.round(n).toLocaleString('en-GB')

export default function HistoryUploadModal({ existingCount, onClose, onSaved }) {
  const [rows, setRows]               = useState(null)
  const [headers, setHeaders]         = useState([])
  const [hasBreakdown, setHasBreakdown] = useState(false)
  const [mode, setMode]               = useState('merge')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [dragging, setDragging]       = useState(false)
  const fileRef = useRef(null)

  const processFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please select a .csv file.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const { rows: parsed, headers: hdrs, hasBreakdown: hb } = parseCsv(e.target.result)
      setRows(parsed)
      setHeaders(hdrs)
      setHasBreakdown(hb)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  const handleFileInput = (e) => processFile(e.target.files[0])

  const validRows   = rows?.filter(r => !r.error) ?? []
  const invalidRows = rows?.filter(r => r.error)  ?? []

  const handleImport = async () => {
    if (validRows.length === 0) return
    setSaving(true)
    setError('')
    try {
      const history = validRows.map(r => {
        const entry = { month: r.month, netWorth: r.netWorth }
        if (hasBreakdown) {
          entry.cash        = r.cash
          entry.pensions    = r.pensions
          entry.investments = r.investments
          entry.property    = r.property
        }
        return entry
      })
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, mode }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json()
      onSaved(updated)
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card-dark border border-card-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="font-playfair text-xl text-text-primary">Upload History CSV</h2>
            <p className="text-text-muted text-xs mt-0.5">
              Import historical net worth data — optionally broken down by category
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Drop zone */}
          {!rows && (
            <>
              <div
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                  dragging ? 'border-gold bg-gold/5' : 'border-white/10 hover:border-white/20'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <p className="text-3xl mb-3">📂</p>
                <p className="text-text-primary text-sm mb-1">Drop a CSV file here, or click to browse</p>
                <p className="text-text-muted text-xs">
                  Requires a date column plus either a net worth column or cash / pensions / investments / property columns
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {/* Download template */}
              <div className="flex items-center justify-between rounded-lg bg-bg-dark border border-white/5 px-3 py-2.5">
                <div>
                  <p className="text-text-primary text-xs font-medium">Not sure of the format?</p>
                  <p className="text-text-muted text-xs">Download the template and fill it in</p>
                </div>
                <a
                  href="/history-template.csv"
                  download="history-template.csv"
                  className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1.5 border border-gold/30 hover:border-gold/60 rounded-lg px-3 py-1.5"
                >
                  ↓ Template CSV
                </a>
              </div>

              {/* Format hints */}
              <div className="rounded-lg bg-bg-dark border border-white/5 p-3 space-y-1.5">
                <p className="text-text-muted text-xs uppercase tracking-wide">Accepted formats</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    ['date,cash,pensions,investments,property', 'Jun 2025,30400,91936,43264,106800'],
                    ['month,cash,pensions,investments,property', 'June 2025,£30,400,£91,936,£43,264,£106,800'],
                    ['date,net_worth', '2025-06-01,270400'],
                    ['period,balance', 'Jun 2025,£270,400'],
                  ].map(([header, example]) => (
                    <div key={header} className="font-mono text-xs bg-card-dark rounded p-2">
                      <p className="text-gold/70">{header}</p>
                      <p className="text-text-muted">{example}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Preview */}
          {rows && (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-400 font-semibold">{validRows.length} valid rows</span>
                {hasBreakdown && (
                  <span className="text-gold/70">with category breakdown</span>
                )}
                {invalidRows.length > 0 && (
                  <span className="text-red-400">{invalidRows.length} skipped</span>
                )}
                <button
                  onClick={() => { setRows(null); setHeaders([]) }}
                  className="ml-auto text-text-muted hover:text-text-primary transition-colors"
                >
                  ← Change file
                </button>
              </div>

              {/* Detected columns */}
              {headers.length > 0 && (
                <p className="text-text-muted text-xs">
                  Detected columns:{' '}
                  {headers.map((h, i) => (
                    <span key={i} className="font-mono text-gold/80">{h}</span>
                  )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-text-muted">, </span>, el], [])}
                </p>
              )}

              {/* Preview table */}
              <div className="rounded-xl border border-white/5 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-bg-dark">
                      <th className="text-left px-4 py-2 text-text-muted text-xs uppercase tracking-wide font-normal">Month</th>
                      {hasBreakdown ? (
                        <>
                          <th className="text-right px-3 py-2 text-text-muted text-xs uppercase tracking-wide font-normal">Cash</th>
                          <th className="text-right px-3 py-2 text-text-muted text-xs uppercase tracking-wide font-normal">Pensions</th>
                          <th className="text-right px-3 py-2 text-text-muted text-xs uppercase tracking-wide font-normal">Investments</th>
                          <th className="text-right px-3 py-2 text-text-muted text-xs uppercase tracking-wide font-normal">Property</th>
                          <th className="text-right px-4 py-2 text-text-muted text-xs uppercase tracking-wide font-normal">Total</th>
                        </>
                      ) : (
                        <th className="text-right px-4 py-2 text-text-muted text-xs uppercase tracking-wide font-normal">Net Worth</th>
                      )}
                      <th className="w-6 px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-white/5 last:border-0 ${row.error ? 'opacity-50' : ''}`}
                      >
                        <td className="px-4 py-2 text-text-primary font-mono text-xs">
                          {row.error ? (
                            <span className="text-red-400" title={row.error}>{row.rawDate}</span>
                          ) : row.month}
                        </td>
                        {hasBreakdown ? (
                          <>
                            {['cash', 'pensions', 'investments', 'property'].map(cat => (
                              <td key={cat} className="px-3 py-2 text-right font-mono text-xs text-text-primary">
                                {row.error ? '—' : fmt(row[cat] ?? 0)}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-right font-playfair text-text-primary">
                              {row.error ? (
                                <span className="text-red-400 text-xs font-mono">error</span>
                              ) : fmt(row.netWorth)}
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-2 text-right font-playfair text-text-primary">
                            {row.error ? (
                              <span className="text-red-400 text-xs font-mono">{row.rawValue}</span>
                            ) : fmt(row.netWorth)}
                          </td>
                        )}
                        <td className="px-4 py-2 text-center text-xs">
                          {row.error
                            ? <span className="text-red-400" title={row.error}>✕</span>
                            : <span className="text-green-400">✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invalid row errors */}
              {invalidRows.length > 0 && (
                <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 space-y-1">
                  <p className="text-red-400 text-xs font-semibold">Rows that will be skipped:</p>
                  {invalidRows.map((r, i) => (
                    <p key={i} className="text-red-400/70 text-xs font-mono">{r.error}</p>
                  ))}
                </div>
              )}

              {/* Mode toggle */}
              <div className="flex gap-3">
                {['merge', 'replace'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm transition-colors ${
                      mode === m
                        ? 'border-gold text-gold bg-gold/5'
                        : 'border-white/10 text-text-muted hover:border-white/20 hover:text-text-primary'
                    }`}
                  >
                    {m === 'merge' ? (
                      <>Merge <span className="text-xs opacity-70">— add to existing {existingCount} points</span></>
                    ) : (
                      <>Replace <span className="text-xs opacity-70">— overwrite all history</span></>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex-shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-white/10 text-text-muted text-sm hover:text-text-primary hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!rows || validRows.length === 0 || saving}
            className="flex-1 py-2.5 rounded-lg bg-gold text-bg-dark text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Importing…' : `Import ${validRows.length > 0 ? validRows.length : ''} rows`}
          </button>
        </div>
      </div>
    </div>
  )
}
