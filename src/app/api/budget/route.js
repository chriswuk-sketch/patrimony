import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'budget.json')

export async function GET() {
  try {
    const raw = fs.readFileSync(dataPath, 'utf8')
    const data = JSON.parse(raw)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read budget data' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    fs.writeFileSync(dataPath, JSON.stringify(body, null, 2))
    return NextResponse.json(body)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save budget data' }, { status: 500 })
  }
}
