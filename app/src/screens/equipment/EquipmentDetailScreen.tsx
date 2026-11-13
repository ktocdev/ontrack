import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button, ButtonLink } from '../../components/Button'
import { Card, DisclosureList, KeyValueRow, ListCard } from '../../components/Card'
import { ClosedTicketRow } from '../../components/ClosedTicketRow'
import { EmptyState } from '../../components/EmptyState'
import { OpenBadge } from '../../components/Equipment'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import { PhotoViewer } from '../../components/Photo'
import { RestaurantName, RestaurantSquare } from '../../components/RestaurantName'
import {
  BackBar,
  Screen,
  ScreenBody,
  ScreenEmpty,
  ScreenFooter,
  SectionLabel,
  UnderlineTabs,
} from '../../components/Screen'
import { DetailSkeleton, MetricsSkeleton } from '../../components/Skeleton'
import { TicketCard } from '../../components/TicketCard'
import { EquipmentMenu } from '../../components/TicketMenu'
import {
  IconChevronRight,
  IconFile,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconTicket,
  IconWarning,
} from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { byPriority } from '../ops/dashboard'
import { longDate, money } from '../tickets/closed'
import { activityLine, ago, AREA_LABEL, byActivity, scheduledLabel } from '../tickets/tickets'
import { monthDay, monthYear, yearOf } from './equipment'
import { LogServiceButton, LogServiceLink } from '../service/TicketService'
import { useEquipmentDetail, useEquipmentService } from './useEquipmentDetail'

/**
 * Equipment details (design/screens/Equipment-Detail, Equipment-Tickets for a manager;
 * Ops-Equipment-Details, Ops-Equipment-Tickets, Ops-Equipment for Ops; Empty-Equipment-
 * Tickets, Empty-Ops-Service, Loading-Equipment-Detail). One screen for both roles, each
 * as its boards draw it: Ops gets the restaurant and Installed in the header and the
 * details in a card. The tabs are routes, so Back returns to the tab you were on.
 * Service & cost is for Ops with see_costs; a manager doesn't need it (from feedback),
 * though one with see_costs still sees what each closed ticket cost. Until QR labels
 * (OT-74) the card where the boards draw the QR shows the serial number alone. Edit is
 * there with Add / edit equipment, which no manager board draws, and the menu beside it
 * has Share link to /e/<id> (OT-71). A manager's Create ticket for this equipment opens
 * the form with the unit filled in, and its Back returns here. Not built yet: Log
 * service and a service record's page (Phase 5). A retired unit still opens, from a
 * ticket or a link, with a Retired label and no Create ticket. Under View as nothing
 * leads anywhere.
 */
const AREA_SHORT = { foh: 'FOH', boh: 'BOH' }
const TABS = [undefined, 'tickets', 'service'] as const

export function EquipmentDetailScreen() {
  return <Detail ops={false} />
}

export function OpsEquipmentDetailScreen() {
  return <Detail ops />
}

function Detail({ ops }: { ops: boolean }) {
  const { id = '', tab } = useParams()
  const { user, restaurants, viewingAs } = useUser()
  const seeCosts = useRight('see_costs')
  const canEdit = useRight('edit_equipment') && !viewingAs
  const canCreate = useRight('create_tickets') && !viewingAs
  const [plateOpen, setPlateOpen] = useState(false)
  // A manager doesn't need a unit's costs (from feedback, Nov 5, 2026), whatever their rights.
  const showService = ops && !!seeCosts
  const [now] = useState(() => new Date())
  const year = now.getFullYear()
  const { data, isPending, isError, refetch } = useEquipmentDetail(id)
  const service = useEquipmentService(id, year, showService && tab === 'service')
  const base = ops ? '/ops/equipment' : '/equipment'
  const back = <BackBar to={base} label="Back to equipment" />

  if (isPending)
    return (
      <Screen>
        {back}
        <ScreenBody className="pb-6 pt-1">
          <DetailSkeleton
            keys={['Name', 'Brand', 'Model', 'Category', 'Location', 'Installed', 'Warranty', 'Manual']}
          />
        </ScreenBody>
      </Screen>
    )
  if (isError)
    return (
      <Screen>
        {back}
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load this equipment"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      </Screen>
    )
  if (!data) return <NotFoundScreen />
  if (!TABS.includes(tab as (typeof TABS)[number]) || (tab === 'service' && (!ops || seeCosts === false)))
    return <Navigate to={`${base}/${id}`} replace />

  const { unit, tickets, manualUrl, plateUrl } = data
  const warranty = unit.warranty_note ?? (unit.warranty_until && `Through ${monthYear(unit.warranty_until)}`)
  const here = `${base}/${unit.id}`
  // A manager reports a problem on a unit in service at one of their own restaurants; the
  // form fills it in.
  const reportable = !ops && canCreate && !unit.retired_at && restaurants.some((r) => r.id === unit.restaurant_id)
  const open = tickets.filter((t) => t.status !== 'closed').sort(ops ? byPriority : byActivity)
  const closed = tickets
    .filter((t) => t.status === 'closed')
    .sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''))
  const subline = [
    unit.brand,
    unit.serial && (
      <span key="serial" className="font-mono">
        {unit.serial}
      </span>
    ),
    ops && unit.installed_on && `Installed ${monthYear(unit.installed_on)}`,
  ].filter(Boolean)

  return (
    <Screen>
      <BackBar
        to={base}
        label="Back to equipment"
        action={
          viewingAs ? undefined : (
            <span className="flex flex-none items-center gap-1">
              {canEdit && (
                <Link
                  to={`${here}/edit`}
                  className="flex min-h-tap flex-none items-center px-2 text-16 font-semibold text-brand hover:text-brand-strong"
                >
                  Edit
                </Link>
              )}
              <EquipmentMenu id={unit.id} name={unit.name} />
            </span>
          )
        }
      >
        <span className="inline-flex flex-wrap items-center gap-x-1">
          {unit.restaurant && (
            <span className="inline-flex items-center gap-1.5 font-bold text-text">
              <RestaurantSquare color={unit.restaurant.color} />
              {unit.restaurant.name}
            </span>
          )}
          {unit.category && (
            <span>
              › {AREA_SHORT[unit.category.area]} › {unit.category.name}
            </span>
          )}
        </span>
      </BackBar>
      <ScreenBody className="gap-4 pb-6 pt-1">
        <div className="flex flex-none flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-30 font-bold leading-tight tracking-[-0.02em]">
            {unit.name}
            {unit.retired_at && (
              <span className="rounded-tag bg-surface-sunken px-2 py-0.5 font-body text-12 font-bold tracking-normal text-text-secondary">
                Retired
              </span>
            )}
          </h1>
          {subline.length > 0 && (ops || tab) && (
            <span className="text-14 text-text-muted">
              {subline.map((part, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {part}
                </span>
              ))}
            </span>
          )}
        </div>

        <UnderlineTabs
          label="Equipment views"
          size="lg"
          inert={viewingAs}
          items={[
            { to: here, label: 'Details', end: true },
            {
              to: `${here}/tickets`,
              label: <>Tickets {open.length > 0 && <OpenBadge count={open.length} compact />}</>,
            },
            ...(showService ? [{ to: `${here}/service`, label: 'Service & cost' }] : []),
          ]}
        />

        {tab === 'tickets' ? (
          open.length + closed.length === 0 ? (
            <EmptyState
              titleSize={20}
              icon={<IconTicket size={30} />}
              title="No tickets yet"
              body={`Nothing has been reported for this ${unit.name.toLowerCase()}. Open and past tickets will show up here.`}
            />
          ) : (
            <>
              {open.length > 0 && (
                <section aria-label="Open tickets" className="flex flex-none flex-col gap-2.5">
                  <SectionLabel>Open · {open.length}</SectionLabel>
                  {open.map((t) =>
                    ops ? (
                      <OpsTicketCard
                        key={t.id}
                        to={viewingAs ? undefined : `/ops/tickets/${t.id}`}
                        displayId={t.display_id ?? ''}
                        title={t.title}
                        status={t.status}
                        statusLabel={
                          t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined
                        }
                        urgent={t.urgency === 'urgent'}
                        walkthrough={t.source === 'walkthrough'}
                        createdAt={t.created_at}
                        meta={[
                          t.category && AREA_SHORT[t.category.area],
                          t.category?.name,
                          ago(new Date(t.created_at), now),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        worker={t.assignee_id === user.id ? null : t.assignee?.full_name}
                      />
                    ) : (
                      <TicketCard
                        key={t.id}
                        to={viewingAs ? undefined : `/tickets/${t.id}`}
                        displayId={t.display_id ?? ''}
                        title={t.title}
                        status={t.status}
                        statusLabel={
                          t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined
                        }
                        walkthrough={t.source === 'walkthrough'}
                        place={[t.category && AREA_LABEL[t.category.area], t.category?.name]
                          .filter(Boolean)
                          .join(' · ')}
                        who={t.assignee ? `${t.assignee.full_name} is on it` : 'Not picked up yet'}
                        when={activityLine(t)}
                        createdAt={t.created_at}
                      />
                    ),
                  )}
                </section>
              )}
              {closed.length > 0 && (
                <ClosedTickets count={closed.length}>
                  {closed.map((t) => (
                    <ClosedTicketRow
                      key={t.id}
                      to={`${ops ? '/ops' : ''}/tickets/${t.id}`}
                      title={t.title}
                      displayId={t.display_id ?? ''}
                      date={t.closed_at ? `Closed ${longDate(new Date(t.closed_at))}` : 'Closed'}
                      cost={seeCosts && t.totalCents ? money(t.totalCents) : undefined}
                    />
                  ))}
                </ClosedTickets>
              )}
            </>
          )
        ) : tab === 'service' ? (
          <Service
            unitName={unit.name}
            warranty={warranty || null}
            year={year}
            query={service}
            logTo={unit.retired_at ? null : `/ops/equipment/${unit.id}/service/new`}
          />
        ) : (
          <>
            {unit.serial && (
              <Card className="flex flex-none flex-col gap-1 p-3.5">
                <span className="text-13 font-medium text-text-muted">Serial number</span>
                <span className="font-mono text-16 text-text">{unit.serial}</span>
              </Card>
            )}
            <Details ops={ops}>
              <KeyValueRow label="Name">{unit.name}</KeyValueRow>
              {unit.brand && <KeyValueRow label="Brand">{unit.brand}</KeyValueRow>}
              {unit.model && (
                <KeyValueRow label="Model">
                  <span className="font-mono font-bold">{unit.model}</span>
                </KeyValueRow>
              )}
              {ops && unit.restaurant && (
                <KeyValueRow label="Restaurant">
                  <RestaurantName variant="plain" name={unit.restaurant.name} color={unit.restaurant.color} />
                </KeyValueRow>
              )}
              {unit.category && (
                <KeyValueRow label="Category">
                  {AREA_LABEL[unit.category.area]} · {unit.category.name}
                </KeyValueRow>
              )}
              {unit.location_note && <KeyValueRow label="Location">{unit.location_note}</KeyValueRow>}
              {unit.installed_on && <KeyValueRow label="Installed">{monthYear(unit.installed_on)}</KeyValueRow>}
              {warranty && <KeyValueRow label="Warranty">{warranty}</KeyValueRow>}
              {unit.manual_path && (
                <KeyValueRow label="Manual">
                  {manualUrl && !viewingAs ? (
                    <a href={manualUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand">
                      {fileName(unit.manual_path)}
                    </a>
                  ) : (
                    fileName(unit.manual_path)
                  )}
                </KeyValueRow>
              )}
              {unit.plate_photo_path && (
                <KeyValueRow label="Data plate">
                  {plateUrl ? (
                    <button type="button" onClick={() => setPlateOpen(true)} className="font-semibold text-brand">
                      View photo
                    </button>
                  ) : (
                    'Photo on file'
                  )}
                </KeyValueRow>
              )}
            </Details>
            <PhotoViewer
              src={plateOpen ? plateUrl : null}
              alt={`Data plate on ${unit.name}`}
              onClose={() => setPlateOpen(false)}
            />
          </>
        )}
      </ScreenBody>
      {reportable && (
        <ScreenFooter>
          <ButtonLink
            variant="tall"
            icon={<IconPlus size={20} />}
            to={`/tickets/new/${unit.category_id}?area=${unit.category?.area ?? 'boh'}&restaurant=${unit.restaurant_id}`}
            state={{ equipmentId: unit.id, backTo: tab ? `${here}/${tab}` : here }}
          >
            Create ticket for this equipment
          </ButtonLink>
        </ScreenFooter>
      )}
    </Screen>
  )
}

const fileName = (path: string) => path.split('/').pop() ?? path

/** A manager's details sit on the screen as the board draws them; Ops's are in a card under a label. */
function Details({ ops, children }: { ops: boolean; children: ReactNode }) {
  return ops ? (
    <section aria-label="Details" className="flex flex-none flex-col gap-2">
      <SectionLabel>Details</SectionLabel>
      <Card className="px-3.5">{children}</Card>
    </section>
  ) : (
    <section aria-label="Details" className="flex-none">
      {children}
    </section>
  )
}

/** Closed tickets under a disclosure, open to begin with, as the manager's board draws it. */
function ClosedTickets({ count, children }: { count: number; children: ReactNode }) {
  return (
    <DisclosureList label="Closed tickets" heading={`Closed · ${count}`} defaultOpen>
      {children}
    </DisclosureList>
  )
}

function Service({
  unitName,
  warranty,
  year,
  query,
  logTo,
}: {
  unitName: string
  warranty: string | null
  year: number
  query: ReturnType<typeof useEquipmentService>
  /** Where "+ Log service" goes; none on a retired unit. */
  logTo: string | null
}) {
  const { data, isPending, isError, refetch } = query
  const location = useLocation()
  if (isPending) return <MetricsSkeleton />
  if (isError)
    return (
      <EmptyState
        tone="neutral"
        titleSize={20}
        icon={<IconWarning size={30} />}
        title="We couldn't load service"
        body="Check your connection and try again."
      >
        <Button variant="small" className="w-full" onClick={() => void refetch()}>
          Try again
        </Button>
      </EmptyState>
    )
  if (data.records.length === 0)
    return (
      <EmptyState
        titleSize={20}
        icon={<IconReceipt size={30} />}
        title="No service logged yet"
        body={
          <>
            Log each repair or maintenance visit to track what this {unitName.toLowerCase()} costs over time and which
            contractors work on it.
            {warranty && <span className="mt-2.5 block text-13">Warranty: {warranty}.</span>}
          </>
        }
      >
        {logTo && <LogServiceButton to={logTo} />}
      </EmptyState>
    )

  const years = [...new Set(data.records.map((r) => yearOf(r.service_date)))]
  return (
    <>
      <div className="flex flex-none flex-col gap-2.5">
        <Stat value={money(data.lifetimeCents)} label="Lifetime cost" />
        <div className="grid grid-cols-2 gap-2.5">
          <Stat value={money(data.yearCents)} label={`${year} cost`} />
          <Stat value={String(data.yearVisits)} label={`Visits ${year}`} />
        </div>
      </div>
      {data.contractors.length > 0 && (
        <section aria-label="Contractors on this unit" className="flex flex-none flex-col gap-2">
          <SectionLabel className="pt-2">Contractors on this unit</SectionLabel>
          <ListCard>
            {data.contractors.map((c) => (
              <div
                key={c.id}
                className="flex min-h-[64px] items-center gap-3 border-t border-surface-muted px-3.5 py-2.5 first:border-t-0"
              >
                <span className="min-w-0 flex-1 text-15 font-semibold">{c.name}</span>
                {c.yearCents === null ? (
                  <span className="flex-none text-13 text-text-muted">No visits in {year}</span>
                ) : (
                  <span className="flex-none text-15 font-bold">{money(c.yearCents)}</span>
                )}
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    aria-label={`Call ${c.name}`}
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-control bg-brand-tint-soft text-brand transition-colors active:bg-brand-tint active:duration-0"
                  >
                    <IconPhone size={20} />
                  </a>
                )}
              </div>
            ))}
          </ListCard>
        </section>
      )}
      {years.map((y) => (
        <section key={y} aria-label={`Service log ${y}`} className="flex flex-none flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <SectionLabel className="pt-2">Service log · {y}</SectionLabel>
            {logTo && y === years[0] && <LogServiceLink to={logTo} className="-mb-2" />}
          </div>
          <ListCard>
            {data.records
              .filter((r) => yearOf(r.service_date) === y)
              .map((r) => (
                <Link
                  key={r.id}
                  to={`/ops/service/${r.id}`}
                  state={{ from: location.pathname }}
                  className="flex min-h-[64px] items-center gap-3 border-t border-surface-muted px-3.5 py-2.5 text-text transition-colors first:border-t-0 hover:bg-surface-hover active:bg-surface-muted active:duration-0"
                >
                  <span className="w-[52px] flex-none text-14 text-text-muted">{monthDay(r.service_date)}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-15 font-semibold [overflow-wrap:anywhere]">{r.title}</span>
                    <span className="text-12 text-text-muted">
                      {r.ticket?.display_id && <span className="font-mono">{r.ticket.display_id}</span>}
                      {r.ticket?.display_id && ' · '}
                      {r.kind === 'in_house' ? 'In-house' : (r.contractor?.name ?? 'Contractor')}
                    </span>
                  </span>
                  {r.kind === 'contractor' &&
                    (r.invoiceMissing ? (
                      <span className="flex-none whitespace-nowrap rounded-tag bg-status-waiting-bg px-1.5 py-0.5 text-11 font-bold text-status-waiting-text">
                        No invoice
                      </span>
                    ) : (
                      <span className="flex-none text-brand">
                        <IconFile size={18} />
                        <span className="sr-only">Invoice on file</span>
                      </span>
                    ))}
                  <span className="flex-none text-15 font-bold">{money(r.totalCents)}</span>
                  <IconChevronRight size={16} className="-ml-1 flex-none text-text-muted" />
                </Link>
              ))}
          </ListCard>
        </section>
      ))}
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card className="flex flex-col gap-0.5 px-3.5 py-3">
      <span className="font-display text-26 font-bold tracking-[-0.01em]">{value}</span>
      <span className="text-13 font-medium text-text-body">{label}</span>
    </Card>
  )
}
