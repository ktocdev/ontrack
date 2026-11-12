import { useState } from 'react'
import type { CostRow } from '../../components/Cost'
import { money } from '../tickets/closed'
import { parseMoney, tidyMoney } from './service'

/** Labor, parts and trip fee as typed, in cents once they read, and the total. */
export function useAmounts(initial = { labor: '', parts: '', trip: '' }, onEdit: () => void) {
  const [amounts, setAmounts] = useState(initial)
  const cents = {
    labor: parseMoney(amounts.labor),
    parts: parseMoney(amounts.parts),
    trip: parseMoney(amounts.trip),
  }
  const ok = cents.labor !== null && cents.parts !== null && cents.trip !== null
  const row = (key: keyof typeof amounts, label: string): CostRow => ({
    label,
    value: amounts[key],
    invalid: cents[key] === null,
    onChange: (v) => {
      onEdit()
      setAmounts((a) => ({ ...a, [key]: v }))
    },
    onBlur: () => setAmounts((a) => ({ ...a, [key]: tidyMoney(a[key]) })),
  })
  return {
    ok,
    cents: { labor: cents.labor ?? 0, parts: cents.parts ?? 0, trip: cents.trip ?? 0 },
    total: ok ? money(cents.labor! + cents.parts! + cents.trip!) : null,
    rows: [row('labor', 'Labor'), row('parts', 'Parts'), row('trip', 'Trip / call-out fee')],
  }
}
