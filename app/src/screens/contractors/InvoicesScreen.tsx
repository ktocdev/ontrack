import { DropdownMenu } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { ListCard } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { SearchField } from '../../components/Field'
import { RestaurantName } from '../../components/RestaurantName'
import { MENU_OPTION, RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenEmpty, ScreenHeader } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { IconCheck, IconChevronDown, IconPlus, IconSort, IconWarning } from '../../components/icons'
import { useRestaurantOrder } from '../ops/useRestaurantOrder'
import { useRestaurantScope } from '../ops/useRestaurantScope'
import { serviceDay } from '../service/service'
import { money } from '../tickets/closed'
import { ContractorTabs } from './ContractorTabs'
import {
  countLabel,
  invoiceView,
  monthLabel,
  monthsOf,
  NEXT_SORT,
  SORT_LABEL,
  startMonth,
  type InvoiceRow,
  type InvoiceSort,
} from './invoices'
import { InvoiceMark } from './InvoiceMark'
import { useInvoices } from './useInvoices'

/**
 * Ops · Invoices (design/screens/Ops-Invoices, and its missingOnly state): every
 * contractor visit in a month, at the restaurants the picker shows, with its invoice or
 * Missing invoice. Search finds a contractor, unit, restaurant, ticket or invoice number;
 * the month menu also has All months, so a missing invoice from earlier can be chased;
 * Missing · N narrows to the ones without, counting the month shown; the sort goes
 * Newest, Oldest, Amount. The line above the list counts what is shown and adds it up.
 * It opens on this month, or the newest month with visits when this one has none. Each
 * row opens the service record, which comes back here. Needs see_costs, which the
 * database asks too. Under View as, rows open nothing.
 */
export function InvoicesScreen() {
  const seeCosts = useRight('see_costs')
  if (seeCosts === false) return <Navigate to="/ops/contractors" replace />
  return <Invoices />
}

function Invoices() {
  const scope = useRestaurantScope()
  const { ordered } = useRestaurantOrder()
  const { data, isPending, isError, refetch } = useInvoices(true)
  const [now] = useState(() => new Date())
  // Undefined until picked: then the month the data suggests, once it has loaded.
  const [picked, setPicked] = useState<string | null | undefined>(undefined)
  const [missingOnly, setMissingOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<InvoiceSort>('new')

  const rows = data ?? []
  const month = picked === undefined ? startMonth(rows, scope.ids, now) : picked
  const view = invoiceView(rows, { restaurantIds: scope.ids, month, missingOnly, query, sort })
  const narrowed = !!query.trim() || missingOnly

  return (
    <Screen>
      <ScreenHeader
        title="Contractors"
        topLeft={
          <RestaurantPicker
            restaurants={ordered}
            selectedId={scope.selected?.id ?? null}
            onSelect={scope.select}
            heading="Show invoices for"
          />
        }
        topRight={<ProfileLink />}
      >
        <ContractorTabs />
        {!isError && (
          <>
            <SearchField
              label="Search invoices"
              placeholder="Contractor, equipment, OT- or invoice #"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery('')}
            />
            <div className="-mx-screen flex gap-2 overflow-x-auto px-screen pb-1 [scrollbar-width:none]">
              <MonthMenu months={monthsOf(rows, scope.ids, now)} value={month} onChange={setPicked} />
              <Chip selected={missingOnly} onClick={() => setMissingOnly((m) => !m)}>
                Missing · {view.missing}
              </Chip>
              <Chip
                selected={false}
                onClick={() => setSort(NEXT_SORT[sort])}
                aria-label={`Sort: ${SORT_LABEL[sort]}. Tap to change.`}
                className="inline-flex items-center gap-1.5"
              >
                <IconSort />
                {SORT_LABEL[sort]}
              </Chip>
            </div>
          </>
        )}
      </ScreenHeader>

      {isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load invoices"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-1">
          {isPending ? (
            <CardFeedSkeleton count={4} label="Loading invoices" />
          ) : (
            <>
              <div className="flex flex-none items-baseline justify-between gap-3 text-13 text-text-secondary">
                <span>{countLabel(view.rows.length, narrowed)}</span>
                <span className="font-mono text-14 font-medium text-text">{money(view.totalCents)}</span>
              </div>
              {view.rows.length > 0 ? (
                <ListCard className="flex-none">
                  {view.rows.map((r) => (
                    <Row key={r.id} row={r} />
                  ))}
                </ListCard>
              ) : (
                <div className="flex flex-none flex-col items-center px-3 py-8 text-center text-14 leading-normal text-text-body">
                  {rows.length === 0
                    ? 'No invoices yet. Contractor visits you log show up here.'
                    : 'No invoices match.'}
                  {(narrowed || month !== startMonth(rows, scope.ids, now)) && rows.length > 0 && (
                    <Button
                      variant="ghost"
                      className="mt-1.5"
                      onClick={() => {
                        setQuery('')
                        setMissingOnly(false)
                        setPicked(undefined)
                      }}
                    >
                      Clear search and filters
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}

/** "October 2026 ▾": the months with visits and this one, newest first, then All months. */
function MonthMenu({
  months,
  value,
  onChange,
}: {
  months: string[]
  value: string | null
  onChange: (month: string | null) => void
}) {
  const ALL = 'all'
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Chip selected={false} aria-label={`Month: ${monthLabel(value)}`} className="inline-flex items-center gap-1.5">
          {monthLabel(value)}
          <IconChevronDown size={14} />
        </Chip>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-30 flex max-h-[min(420px,60dvh)] w-[240px] flex-col overflow-y-auto rounded-card border border-border bg-surface p-1.5 text-text shadow-raised"
        >
          <DropdownMenu.Label className="eyebrow px-2.5 pb-1.5 pt-2">Show invoices from</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
            {months.map((m) => (
              <MonthOption key={m} value={m}>
                {monthLabel(m)}
              </MonthOption>
            ))}
            <MonthOption value={ALL}>All months</MonthOption>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function MonthOption({ value, children }: { value: string; children: ReactNode }) {
  return (
    <DropdownMenu.RadioItem value={value} className={MENU_OPTION}>
      <span className="min-w-0 flex-1 font-semibold">{children}</span>
      <DropdownMenu.ItemIndicator>
        <IconCheck size={18} strokeWidth={2.6} className="text-brand" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  )
}

/** The board's row: the file or a dashed + for a missing one, who and where, the date and number, the amount. */
function Row({ row: r }: { row: InvoiceRow }) {
  const location = useLocation()
  const { viewingAs } = useUser()
  const amount = money(r.totalCents)
  const body = (
    <>
      <InvoiceMark isMissing={r.invoiceMissing} missing={<IconPlus size={16} strokeWidth={2.2} />} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-15 font-semibold [overflow-wrap:anywhere]">{r.contractor?.name ?? 'Contractor'}</span>
        {r.restaurant && <RestaurantName variant="meta" name={r.restaurant.name} color={r.restaurant.color} />}
        {r.equipment && <span className="text-12 text-text-muted">{r.equipment.name}</span>}
        {r.ticket?.display_id && <span className="font-mono text-12 text-text-muted">{r.ticket.display_id}</span>}
        <span className="text-12 text-text-muted">
          {serviceDay(r.service_date)} · {r.invoiceMissing ? 'Missing invoice' : (r.invoiceNumber ?? 'Invoice on file')}
        </span>
      </span>
      <span className="flex-none font-mono text-14 font-medium">{amount}</span>
    </>
  )
  const label = [r.contractor?.name, r.equipment?.name, amount, r.invoiceMissing && 'missing invoice']
    .filter(Boolean)
    .join(', ')
  const cls =
    'flex min-h-16 items-center gap-3 border-t border-border px-3.5 py-2.5 text-text first:border-t-0 transition-colors'
  return viewingAs ? (
    <div className={cls}>{body}</div>
  ) : (
    <Link
      to={`/ops/service/${r.id}`}
      state={{ from: location.pathname }}
      aria-label={label}
      className={`${cls} hover:bg-surface-hover active:bg-surface-muted active:duration-0`}
    >
      {body}
    </Link>
  )
}
