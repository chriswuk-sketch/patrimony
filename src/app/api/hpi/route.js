import { NextResponse } from 'next/server'
import { laToSlug } from '@/lib/localAuthorities'

const SPARQL_ENDPOINT = 'https://landregistry.data.gov.uk/landregistry/query'
const REGION_BASE     = 'http://landregistry.data.gov.uk/id/region/'
const UKHPI           = 'http://landregistry.data.gov.uk/def/ukhpi/'

// Map property type to the specific ukhpi index predicate
const INDEX_PREDICATE = {
  flat:           `${UKHPI}housePriceIndexFlatMaisonette`,
  terraced:       `${UKHPI}housePriceIndexTerraced`,
  'semi-detached':`${UKHPI}housePriceIndexSemiDetached`,
  detached:       `${UKHPI}housePriceIndexDetached`,
}
const INDEX_OVERALL = `${UKHPI}housePriceIndex`

function buildQuery(regionUri, indexPredicate) {
  return `PREFIX ukhpi: <${UKHPI}>

SELECT ?refMonth ?index WHERE {
  ?obs ukhpi:refRegion <${regionUri}> ;
       ukhpi:refMonth  ?refMonth ;
       <${indexPredicate}> ?index .
}
ORDER BY ?refMonth
LIMIT 500`
}

async function runSparql(query) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 28000)
  try {
    const res = await fetch(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json',
      },
      body: new URLSearchParams({ query }).toString(),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`SPARQL HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function parseResults(json) {
  const bindings = json?.results?.bindings ?? []
  const seen = new Set()
  return bindings
    .map(b => {
      const month = (b.refMonth?.value ?? '').match(/\d{4}-\d{2}/)?.[0]
      const index = parseFloat(b.index?.value)
      return (!month || isNaN(index)) ? null : { month, index }
    })
    .filter(Boolean)
    .sort((a, b) => a.month.localeCompare(b.month))
    .filter(d => seen.has(d.month) ? false : (seen.add(d.month), true))
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const laName       = searchParams.get('la')
  const propertyType = searchParams.get('type')

  if (!laName) {
    return NextResponse.json({ error: 'Missing la parameter' }, { status: 400 })
  }

  const regionUri    = `${REGION_BASE}${laToSlug(laName)}`
  const typePredicate = INDEX_PREDICATE[propertyType]

  try {
    let data = []
    let usedFallback = false

    // Primary: property-type-specific index
    if (typePredicate) {
      const json = await runSparql(buildQuery(regionUri, typePredicate))
      data = parseResults(json)
    }

    // Fallback: overall index (all types)
    if (data.length < 24) {
      const json = await runSparql(buildQuery(regionUri, INDEX_OVERALL))
      const fallback = parseResults(json)
      if (fallback.length > data.length) {
        data = fallback
        usedFallback = !!typePredicate
      }
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: `No HPI data found for "${laName}". Try a different local authority.` },
        { status: 404 }
      )
    }

    return NextResponse.json({ data, usedFallback })
  } catch (err) {
    if (err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'The Land Registry HPI service timed out. Please try again.' },
        { status: 504 }
      )
    }
    console.error('[HPI] SPARQL error:', err.message)
    return NextResponse.json(
      { error: 'Failed to fetch HPI data. The Land Registry service may be unavailable.' },
      { status: 502 }
    )
  }
}
