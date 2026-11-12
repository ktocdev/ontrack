import { useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { ContractorCard } from '../../components/ContractorCard'
import { EmptyState } from '../../components/EmptyState'
import { SearchField } from '../../components/Field'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenHeader } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconBriefcase, IconPlus, IconSearchOff, IconWarning } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useRestaurantOrder } from '../ops/useRestaurantOrder'
import { useRestaurantScope } from '../ops/useRestaurantScope'
import { AddContractorSheet } from '../service/ServiceFields'
import { serviceDay } from '../service/service'
import { useTrades } from '../service/useLogService'
import {
  matchesSearch,
  sortRows,
  summarize,
  tradeChips,
  tradeCount,
  wholeDollars,
  type DirectoryRow,
  type Sort,
} from './contractors'
import { useContractorDirectory } from './useContractorDirectory'

/**
 * Ops · Contractor directory (design/screens/Ops-Contractors, Empty-Ops-Contractors,
 * Empty-Search-Contractors). Contractors are the group's, so the list is every one not
 * archived; the spend, visits and last visit on each follow the restaurant picker, as
 * the dashboard does (decided Nov 11, 2026), and show only with see_costs. Search finds
 * a company, contact or trade; the chips after "All" are the trades in the list, most
 * contractors first, and a count shows on All as the board draws it. "Most used first"
 * (this year's visits) switches to "Highest spend first". A contractor whose insurance
 * runs out within 30 days, or has, is flagged. The call button dials straight away.
 * Add opens the short add sheet until the full Add contractor screen (OT-95), and a
 * card opens nothing until the contractor page (OT-95). Import from a spreadsheet waits
 * for Phase 7, and the Invoices tab for OT-96. Under View as, Add is gone.
 */
export function ContractorsScreen() {
  const seeContractors = useRight('see_contractors')
  if (seeContractors === false) return <NotFoundScreen />
  return <Directory />
}

const SORT_LABEL: Record<Sort, string> = { used: 'Most used first', spend: 'Highest spend first' }

function Directory() {
  const { viewingAs } = useUser()
  const scope = useRestaurantScope()
  const { ordered } = useRestaurantOrder()
  const seeCosts = !!useRight('see_costs')
  const canAdd = !!useRight('log_cost') && !viewingAs
  const { data, isPending, isError, refetch } = useContractorDirectory(seeCosts)
  const trades = useTrades()
  const toast = useToast()
  const [year] = useState(() => new Date().getFullYear())
  const [query, setQuery] = useState('')
  const [trade, setTrade] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('used')
  const [adding, setAdding] = useState<{ trade: string } | null>(null)

  const contractors = data?.contractors ?? []
  const rows = data ? summarize(contractors, data.spend, scope.ids, year) : []
  const shown = sortRows(
    rows.filter((r) => (!trade || r.trade === trade) && matchesSearch(r, query)),
    seeCosts ? sort : 'used',
  )
  const empty = !isPending && !isError && contractors.length === 0
  const q = query.trim()
  // "Add a roofing contractor" when the search names a trade on the list.
  const searchedTrade = (trades.data ?? []).find((t) => t.toLowerCase() === q.toLowerCase())

  const visitsLine = (r: DirectoryRow) =>
    seeCosts
      ? [
          r.yearVisits ? `${r.yearVisits} visit${r.yearVisits === 1 ? '' : 's'}` : `No visits in ${year}`,
          r.lastVisit && `last ${serviceDay(r.lastVisit)}`,
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined

  return (
    <Screen>
      <ScreenHeader
        title="Contractors"
        topLeft={
          <RestaurantPicker
            restaurants={ordered}
            selectedId={scope.selected?.id ?? null}
            onSelect={scope.select}
            heading="Show spend for"
          />
        }
        topRight={<ProfileLink />}
        action={
          canAdd && !empty ? (
            <Button
              variant="compact"
              aria-label="Add contractor"
              icon={<IconPlus size={18} strokeWidth={2.4} />}
              className="gap-1.5 px-3.5 text-14"
              onClick={() => setAdding({ trade: '' })}
            >
              Add
            </Button>
          ) : undefined
        }
      >
        {!empty && !isError && (
          <>
            <SearchField
              label="Search contractors"
              placeholder="Company, contact or trade"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery('')}
            />
            <div className="-mx-screen flex gap-2 overflow-x-auto px-screen pb-1 [scrollbar-width:none]">
              <Chip selected={!trade} onClick={() => setTrade(null)}>
                All · {contractors.length}
              </Chip>
              {tradeChips(contractors).map((t) => (
                <Chip key={t} selected={trade === t} onClick={() => setTrade(trade === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </>
        )}
      </ScreenHeader>

      {isError ? (
        <EmptyState
          tone="neutral"
          titleSize={20}
          icon={<IconWarning size={30} />}
          title="We couldn't load contractors"
          body="Check your connection and try again."
        >
          <Button variant="small" className="w-full" onClick={() => void refetch()}>
            Try again
          </Button>
        </EmptyState>
      ) : empty ? (
        <EmptyState
          icon={<IconBriefcase size={30} />}
          title="No contractors yet"
          body={
            <>
              Add the companies you call for repairs. You can then pick them when you log service and see what you spend
              with each.
              <span className="mt-2.5 block text-13">You can also add one while logging service on a ticket.</span>
            </>
          }
        >
          {canAdd && (
            <Button
              variant="medium"
              className="w-full"
              icon={<IconPlus size={18} strokeWidth={2.2} />}
              onClick={() => setAdding({ trade: '' })}
            >
              Add contractor
            </Button>
          )}
        </EmptyState>
      ) : !isPending && shown.length === 0 ? (
        <EmptyState
          tone="neutral"
          icon={<IconSearchOff size={30} />}
          title={q ? `No contractors match "${q}"` : `No ${trade} contractors`}
          body={
            q
              ? `None of your ${contractors.length} contractors match that company, contact or trade.${canAdd ? ' Add one if you’ve found someone new.' : ''}`
              : 'None of your contractors have this trade yet.'
          }
        >
          <div className="flex flex-col gap-2.5">
            {canAdd && (
              <Button
                variant="medium"
                className="w-full"
                icon={<IconPlus size={18} strokeWidth={2.2} />}
                onClick={() => setAdding({ trade: searchedTrade ?? trade ?? '' })}
              >
                {searchedTrade ? `Add a ${searchedTrade.toLowerCase()} contractor` : 'Add contractor'}
              </Button>
            )}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setQuery('')
                setTrade(null)
              }}
            >
              {q ? 'Clear search' : 'Show all'}
            </Button>
          </div>
        </EmptyState>
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-0">
          {isPending ? (
            <CardFeedSkeleton count={4} label="Loading contractors" />
          ) : (
            <>
              <div className="-mt-1 flex min-h-9 items-center justify-between gap-3 text-13 text-text-secondary">
                {seeCosts ? (
                  <button
                    type="button"
                    onClick={() => setSort(sort === 'used' ? 'spend' : 'used')}
                    aria-label={`${SORT_LABEL[sort]}. Change the order`}
                    className="-mx-1 flex min-h-9 items-center rounded-control px-1 text-left hover:text-text"
                  >
                    {trade ? `${tradeCount(shown.length, trade)} · ` : ''}
                    {SORT_LABEL[sort]}
                  </button>
                ) : (
                  <span>{trade ? tradeCount(shown.length, trade) : `${shown.length} contractors`}</span>
                )}
                {seeCosts && <span className="flex-none">Spend · {year}</span>}
              </div>
              {shown.map((r) => (
                <ContractorCard
                  key={r.id}
                  name={r.name}
                  trade={r.trade}
                  preferred={r.preferred}
                  warning={r.insurance}
                  contact={r.contact_name}
                  visits={visitsLine(r)}
                  spend={seeCosts ? (r.yearCents ? wholeDollars(r.yearCents) : '$0') : undefined}
                  phone={r.phone}
                />
              ))}
            </>
          )}
        </ScreenBody>
      )}
      {adding && (
        <AddContractorSheet
          trade={adding.trade}
          onClose={() => setAdding(null)}
          onAdded={() => {
            setAdding(null)
            setQuery('')
            setTrade(null)
            toast.show('Contractor added.')
          }}
        />
      )}
    </Screen>
  )
}
