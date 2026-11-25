/**
 * Leadership's Spend (from feedback, Nov 24, 2026; no board), with no screen in it so Vitest
 * can check it: a month's visits at the restaurants in scope, every kind, as the Overview's
 * Spend counts them (v_overview_by_month: every visit dated in the month, contractor and
 * in-house, with or without a ticket), split by kind and added up by restaurant, contractor
 * and category.
 */

export type SpendVisit = {
  id: string
  service_date: string
  title: string
  kind: 'contractor' | 'in_house'
  restaurant_id: string
  restaurant: { name: string; color: string } | null
  contractor: { id: string; name: string } | null
  equipment: { name: string; category: { name: string } | null } | null
  ticket: { display_id: string | null; category: { name: string } | null } | null
  totalCents: number
  invoiceMissing: boolean
}

export type SpendRestaurant = { id: string; name: string; color: string }

export type SpendLine = {
  key: string
  name: string
  cents: number
  visits: number
}

export type SpendView = {
  totalCents: number
  contractorCents: number
  inHouseCents: number
  visits: SpendVisit[]
  /** Contractor visits in the month with no invoice on file. */
  missing: number
  /** Every restaurant in scope, the most spent first, those with none too. */
  byRestaurant: (SpendRestaurant & { cents: number; visits: number })[]
  /** Each contractor, and in-house work as one line, the most spent first. */
  byContractor: (SpendLine & { contractorId: string | null })[]
  /** The unit's category, else the ticket's, else No category; the most spent first. */
  byCategory: SpendLine[]
}

export const IN_HOUSE = 'In-house'
export const NO_CATEGORY = 'No category'

/** The category a visit counts under: its unit's, else its ticket's, else none. */
export function categoryOf(v: SpendVisit) {
  return v.equipment?.category?.name ?? v.ticket?.category?.name ?? NO_CATEGORY
}

/** Who did the work: the contractor, or In-house. */
export function workerOf(v: SpendVisit) {
  return v.kind === 'in_house' ? IN_HOUSE : (v.contractor?.name ?? 'Contractor')
}

const byCents = <T extends { cents: number; name: string }>(a: T, b: T) =>
  b.cents - a.cents || a.name.localeCompare(b.name)

function addUp<T extends SpendLine>(lines: Map<string, T>, key: string, make: () => T, cents: number) {
  const line = lines.get(key) ?? make()
  line.cents += cents
  line.visits += 1
  lines.set(key, line)
}

/** The month's visits ("2026-10-01") at these restaurants, newest first, and their totals. */
export function spendFor(all: SpendVisit[], restaurants: SpendRestaurant[], month: string): SpendView {
  const here = new Set(restaurants.map((r) => r.id))
  const prefix = month.slice(0, 7)
  const visits = all
    .filter((v) => here.has(v.restaurant_id) && v.service_date.startsWith(prefix))
    .sort((a, b) => b.service_date.localeCompare(a.service_date) || b.totalCents - a.totalCents)

  const contractors = new Map<string, SpendLine & { contractorId: string | null }>()
  const categories = new Map<string, SpendLine>()
  for (const v of visits) {
    const inHouse = v.kind === 'in_house'
    const key = inHouse ? 'in_house' : (v.contractor?.id ?? 'contractor')
    addUp(
      contractors,
      key,
      () => ({
        key,
        name: workerOf(v),
        cents: 0,
        visits: 0,
        contractorId: inHouse ? null : (v.contractor?.id ?? null),
      }),
      v.totalCents,
    )
    const category = categoryOf(v)
    addUp(categories, category, () => ({ key: category, name: category, cents: 0, visits: 0 }), v.totalCents)
  }

  const sum = (vs: SpendVisit[]) => vs.reduce((n, v) => n + v.totalCents, 0)
  return {
    totalCents: sum(visits),
    contractorCents: sum(visits.filter((v) => v.kind === 'contractor')),
    inHouseCents: sum(visits.filter((v) => v.kind === 'in_house')),
    visits,
    missing: visits.filter((v) => v.kind === 'contractor' && v.invoiceMissing).length,
    byRestaurant: restaurants
      .map((r) => {
        const at = visits.filter((v) => v.restaurant_id === r.id)
        return { ...r, cents: sum(at), visits: at.length }
      })
      .sort(byCents),
    byContractor: [...contractors.values()].sort(byCents),
    byCategory: [...categories.values()].sort(byCents),
  }
}

/** "1 visit", "3 visits". */
export const visitCount = (n: number) => `${n} visit${n === 1 ? '' : 's'}`
