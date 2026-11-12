import { useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button, ButtonLink } from '../../components/Button'
import { ListCard, ListRowLink } from '../../components/Card'
import { Chip } from '../../components/Chip'
import { ContractorCard } from '../../components/ContractorCard'
import { EmptyState } from '../../components/EmptyState'
import { SearchField } from '../../components/Field'
import { OverflowMenu } from '../../components/Menu'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenHeader } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import {
  IconBriefcase,
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconSearchOff,
  IconWarning,
} from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useRestaurantOrder } from '../ops/useRestaurantOrder'
import { useRestaurantScope } from '../ops/useRestaurantScope'
import { serviceDay } from '../service/service'
import { useCanEditTrades, useTrades } from '../trades/useTrades'
import {
  matchesSearch,
  sortRows,
  summarize,
  tradeChips,
  tradeCount,
  wholeDollars,
  type Contractor,
  type DirectoryRow,
  type Sort,
} from './contractors'
import { ContractorTabs } from './ContractorTabs'
import { useContractorDirectory } from './useContractorDirectory'

/**
 * Ops · Contractor directory (design/screens/Ops-Contractors, Empty-Ops-Contractors,
 * Empty-Search-Contractors). Contractors are the group's, so the list is every one not
 * archived; the spend, visits and last visit on each follow the restaurant picker, as
 * the dashboard does (decided Nov 11, 2026), and show only with see_costs. Search finds
 * a company, contact or trade; the chips after "All" are the trades in the list, most
 * contractors first, and a count shows on All as the board draws it. A contractor can
 * have several trades (OT-99): the card shows each, and every one of their chips finds
 * them. The menu beside Add opens Trades for whoever looks after them. "Most used first"
 * (this year's visits) switches to "Highest spend first". A contractor whose insurance
 * runs out within 30 days, or has, is flagged. The call button dials straight away.
 * Add opens Add contractor, on the trade a search named; a card opens the contractor
 * (OT-95). Archived contractors sit apart under a closed Archived disclosure at the
 * bottom, found by the search and chips too, so one can be restored. Import from a
 * spreadsheet waits for Phase 7. The Directory and Invoices tabs (OT-96) sit under the
 * title for anyone with see_costs. Under View as, Add is
 * gone and nothing opens.
 */
export function ContractorsScreen() {
  const seeContractors = useRight('see_contractors')
  if (seeContractors === false) return <NotFoundScreen />
  return <Directory />
}

/** Room for an empty state that scrolls when it doesn't fit under the header, as on a short phone. */
const EMPTY = 'flex min-h-0 flex-1 flex-col overflow-y-auto'

const SORT_LABEL: Record<Sort, string> = { used: 'Most used first', spend: 'Highest spend first' }

function Directory() {
  const { viewingAs } = useUser()
  const scope = useRestaurantScope()
  const { ordered } = useRestaurantOrder()
  const seeCosts = !!useRight('see_costs')
  const canAdd = !!useRight('log_cost') && !viewingAs
  const { data, isPending, isError, refetch } = useContractorDirectory(seeCosts)
  const trades = useTrades()
  const canEditTrades = useCanEditTrades()
  const [year] = useState(() => new Date().getFullYear())
  const [query, setQuery] = useState('')
  const [trade, setTrade] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('used')

  const all = data?.contractors ?? []
  const contractors = all.filter((c) => !c.archived_at)
  // Archived ones sit apart at the bottom, so one can be found and restored.
  const archived = all.filter((c) => c.archived_at && matchesSearch(c, query) && (!trade || c.trades.includes(trade)))
  const rows = data ? summarize(contractors, data.spend, scope.ids, year) : []
  const shown = sortRows(
    rows.filter((r) => (!trade || r.trades.includes(trade)) && matchesSearch(r, query)),
    seeCosts ? sort : 'used',
  )
  const empty = !isPending && !isError && contractors.length === 0
  const q = query.trim()
  // "Add a roofing contractor" when the search names a trade on the list.
  const searchedTrade = (trades.data ?? []).find((t) => t.active && t.name.toLowerCase() === q.toLowerCase())?.name

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
          (canAdd && !empty) || canEditTrades ? (
            <span className="flex flex-none items-center gap-2">
              {canAdd && !empty && (
                <ButtonLink
                  to="/ops/contractors/new"
                  variant="compact"
                  aria-label="Add contractor"
                  icon={<IconPlus size={18} strokeWidth={2.4} />}
                  className="gap-1.5 px-3.5 text-14"
                >
                  Add
                </ButtonLink>
              )}
              {canEditTrades && (
                <OverflowMenu
                  label="More options for contractors"
                  items={[{ to: '/ops/contractors/trades', label: 'Trades' }]}
                />
              )}
            </span>
          ) : undefined
        }
      >
        <ContractorTabs />
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
        <div className={EMPTY}>
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
        </div>
      ) : empty ? (
        <div className={EMPTY}>
          <EmptyState
            icon={<IconBriefcase size={30} />}
            title="No contractors yet"
            body={
              <>
                Add the companies you call for repairs. You can then pick them when you log service and see what you
                spend with each.
                <span className="mt-2.5 block text-13">You can also add one while logging service on a ticket.</span>
              </>
            }
          >
            {canAdd && (
              <ButtonLink
                to="/ops/contractors/new"
                variant="medium"
                className="w-full"
                icon={<IconPlus size={18} strokeWidth={2.2} />}
              >
                Add contractor
              </ButtonLink>
            )}
          </EmptyState>
        </div>
      ) : !isPending && shown.length === 0 ? (
        <div className={EMPTY}>
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
                <ButtonLink
                  to={addTo(searchedTrade ?? trade)}
                  variant="medium"
                  className="w-full"
                  icon={<IconPlus size={18} strokeWidth={2.2} />}
                >
                  {searchedTrade ? `Add a ${searchedTrade.toLowerCase()} contractor` : 'Add contractor'}
                </ButtonLink>
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
        </div>
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
                  trades={r.trades}
                  preferred={r.preferred}
                  warning={r.insurance}
                  contact={r.contact_name}
                  visits={visitsLine(r)}
                  spend={seeCosts ? (r.yearCents ? wholeDollars(r.yearCents) : '$0') : undefined}
                  phone={r.phone}
                  to={viewingAs ? undefined : `/ops/contractors/${r.id}`}
                />
              ))}
              {archived.length > 0 && <Archived contractors={archived} inert={!!viewingAs} />}
            </>
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}

/** "Add a roofing contractor" opens Add contractor on that trade. */
const addTo = (trade: string | null | undefined) =>
  trade ? `/ops/contractors/new?trade=${encodeURIComponent(trade)}` : '/ops/contractors/new'

/** Archived contractors under a disclosure, closed to begin with; each opens their page to restore them. */
function Archived({ contractors, inert }: { contractors: Contractor[]; inert: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <section aria-label="Archived contractors" className="mt-2 flex flex-none flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="-mx-1 flex min-h-tap items-center gap-2 px-1 text-left"
      >
        <IconChevronDown
          size={18}
          className={`flex-none text-text-secondary transition-transform ${open ? '' : '-rotate-90'}`}
        />
        <span className="eyebrow flex-1">Archived · {contractors.length}</span>
        <span className="text-14 font-semibold text-brand">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <ListCard>
          {contractors.map((c) =>
            inert ? (
              <div
                key={c.id}
                className="flex min-h-[60px] flex-col justify-center border-t border-border px-3.5 py-2.5 first:border-t-0"
              >
                <span className="text-14 font-semibold">{c.name}</span>
                <span className="text-12 text-text-muted">{c.trades.join(' · ')}</span>
              </div>
            ) : (
              <ListRowLink
                key={c.id}
                to={`/ops/contractors/${c.id}`}
                title={c.name}
                subtitle={c.trades.join(' · ')}
                trailing={<IconChevronRight className="text-text-muted" />}
              />
            ),
          )}
        </ListCard>
      )}
    </section>
  )
}
