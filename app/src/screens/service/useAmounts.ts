import { useState } from 'react'
import type { CostRow } from '../../components/Cost'
import { money } from '../tickets/closed'
import { parseMoney, tidyMoney } from './service'

/**
 * Labor, parts and trip fee as typed, in cents once they read, and the total. In-house
 * work asks only for parts (from feedback, Nov 11, 2026: what the team spends on its own
 * fixes); a labor or trip amount already there stays shown, so nothing counted is hidden.
 */
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
    rows: (kind: 'in_house' | 'contractor') =>
      [
        { key: 'labor' as const, label: 'Labor' },
        { key: 'parts' as const, label: 'Parts' },
        { key: 'trip' as const, label: 'Trip / call-out fee' },
      ]
        .filter((r) => kind === 'contractor' || r.key === 'parts' || (cents[r.key] ?? 1) !== 0)
        .map((r) => row(r.key, r.label)),
  }
}
