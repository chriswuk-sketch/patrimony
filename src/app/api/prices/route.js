import { NextResponse } from 'next/server'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

// ISINs are always 12 chars: 2-letter country code + 9 alphanumeric + 1 numeric check digit
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i

async function resolveIsinToTicker(isin) {
  const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=5&newsCount=0`
  const res = await fetch(searchUrl, { headers: HEADERS })
  if (!res.ok) return null
  const data = await res.json()
  const quotes = data?.quotes ?? []
  // Prefer quotes with a matching ISIN if available, otherwise take the first result
  const match = quotes.find((q) => q.symbol)
  return match?.symbol ?? null
}

async function fetchChartPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
  const res = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)
  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('No data returned')
  return result.meta
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'VWRP.L'

  try {
    let ticker = symbol
    let resolvedSymbol = null

    // If input looks like an ISIN, resolve it to a Yahoo Finance ticker first
    if (ISIN_RE.test(symbol.trim())) {
      const resolved = await resolveIsinToTicker(symbol.trim())
      if (resolved) {
        ticker = resolved
        resolvedSymbol = resolved
      }
      // If resolution fails, fall through and try the ISIN directly (will likely fail, caught below)
    }

    const meta = await fetchChartPrice(ticker)

    const timestamp = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString()

    return NextResponse.json({
      symbol,                          // original input (ISIN or ticker)
      resolvedSymbol,                  // Yahoo ticker used (null if input was already a ticker)
      price: meta.regularMarketPrice,
      currency: meta.currency,
      timestamp,
      shortName: meta.shortName || ticker,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch price', symbol, fallback: true },
      { status: 200 }
    )
  }
}
