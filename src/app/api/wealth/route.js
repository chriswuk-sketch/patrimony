import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'wealth.json')

export async function GET() {
  try {
    const raw = fs.readFileSync(dataPath, 'utf8')
    const data = JSON.parse(raw)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read wealth data' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const raw = fs.readFileSync(dataPath, 'utf8')
    const existing = JSON.parse(raw)

    // Cash: full replace (manage modal) takes priority over per-id value updates (monthly modal)
    let updatedCash
    if (body.cashAccounts) {
      updatedCash = { accounts: body.cashAccounts }
    } else if (body.cashValues) {
      updatedCash = {
        accounts: existing.cash.accounts.map((a) => ({
          ...a,
          value: body.cashValues[a.id] ?? a.value,
        })),
      }
    } else {
      updatedCash = existing.cash
    }

    // ISA: full replace (manage modal) takes priority over per-id value updates (monthly modal)
    let updatedIsa
    if (body.isaHoldings) {
      updatedIsa = { holdings: body.isaHoldings }
    } else if (body.isaValues) {
      updatedIsa = {
        holdings: existing.isa.holdings.map((h) => ({
          ...h,
          value: body.isaValues[h.id] ?? h.value,
        })),
      }
    } else {
      updatedIsa = existing.isa
    }

    // Pension: full replace (manage modal) takes priority over per-id value updates (monthly modal)
    let updatedPension
    if (body.pensionHoldings) {
      updatedPension = { holdings: body.pensionHoldings }
    } else if (body.pensionValues) {
      updatedPension = {
        holdings: existing.pension.holdings.map((h) => ({
          ...h,
          value: body.pensionValues[h.id] ?? h.value,
        })),
      }
    } else {
      updatedPension = existing.pension
    }

    // Property: full replace (manage modal) takes priority over per-field updates (monthly modal)
    let updatedProperty
    if (body.propertyResidence) {
      updatedProperty = { primaryResidence: body.propertyResidence }
    } else {
      updatedProperty = {
        primaryResidence: {
          ...existing.property.primaryResidence,
          estimatedValue: body.propertyValue ?? existing.property.primaryResidence.estimatedValue,
          mortgageBalance: body.mortgageBalance ?? existing.property.primaryResidence.mortgageBalance,
        },
      }
    }

    // Liabilities: full replace (manage modal) takes priority over per-field updates (monthly modal)
    let updatedLiabilities
    if (body.mortgageData) {
      updatedLiabilities = { mortgage: body.mortgageData }
    } else {
      updatedLiabilities = {
        mortgage: {
          ...existing.liabilities.mortgage,
          balance: body.mortgageBalance ?? existing.liabilities.mortgage.balance,
        },
      }
    }

    const updated = {
      ...existing,
      lastUpdated: new Date().toISOString().split('T')[0],
      cash: updatedCash,
      isa: updatedIsa,
      property: updatedProperty,
      pension: updatedPension,
      liabilities: updatedLiabilities,
    }

    fs.writeFileSync(dataPath, JSON.stringify(updated, null, 2))
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update wealth data' }, { status: 500 })
  }
}
