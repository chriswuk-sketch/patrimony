import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'history.json')

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthLabelToSortKey(label) {
  const parts = label.split(' ')
  const mi = MONTHS.indexOf(parts[0])
  const year = parseInt(parts[1], 10)
  return isNaN(year) || mi === -1 ? 0 : year * 12 + mi
}

export async function GET() {
  try {
    const raw = fs.readFileSync(dataPath, 'utf8')
    const data = JSON.parse(raw)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read history data' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const incoming = body.history ?? []
    const mode = body.mode ?? 'merge'

    let finalHistory

    if (mode === 'replace') {
      finalHistory = incoming
    } else {
      // Merge: existing entries are overwritten by incoming if same month label
      const raw = fs.readFileSync(dataPath, 'utf8')
      const existing = JSON.parse(raw).history ?? []
      const byMonth = {}
      for (const entry of existing) byMonth[entry.month] = entry
      for (const entry of incoming) byMonth[entry.month] = entry
      finalHistory = Object.values(byMonth)
    }

    // Sort chronologically
    finalHistory.sort((a, b) => monthLabelToSortKey(a.month) - monthLabelToSortKey(b.month))

    const updated = { history: finalHistory }
    fs.writeFileSync(dataPath, JSON.stringify(updated, null, 2))
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update history' }, { status: 500 })
  }
}
