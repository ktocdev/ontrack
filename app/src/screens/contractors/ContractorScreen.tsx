import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button, ButtonLink, buttonClasses } from '../../components/Button'
import { Card, KeyValueRow, ListCard } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { RestaurantName } from '../../components/RestaurantName'
import { BackBar, Screen, ScreenBody, ScreenEmpty, SectionLabel, UnderlineTabs } from '../../components/Screen'
import { DetailSkeleton } from '../../components/Skeleton'
import { ContractorMenu } from '../../components/TicketMenu'
import {
  IconChevronRight,
  IconFile,
  IconMail,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconStar,
  IconWarning,
} from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useRestaurantScope } from '../ops/useRestaurantScope'
import { serviceDay } from '../service/service'
import { money } from '../tickets/closed'
import { insuranceLine, mailtoHref, summarizeVisits, visitsLabel, type Visit } from './contractor'
import { insuranceWarning } from './contractors'
import { InvoiceMark } from './InvoiceMark'
import { useContractor, type ContractorData } from './useContractor'

/**
 * Ops · Contractor detail (design/screens/Ops-Contractor). The name with a tag for each
 * trade (OT-99), Preferred and any insurance warning; Call and Email; this year's spend,
 * visits and the last visit; the details; then Visits and Invoices, each row opening the
 * service record, and Back returns here. Contractors are the group's, so the amounts and
 * the lists follow the restaurant picker on the Ops screens, as the directory does, and
 * say so when it is one restaurant. Amounts and both tabs need see_costs. The tabs are
 * routes, so Back returns to the tab you were on. No board draws a way to log a visit
 * here, so the menu has Log service (log_cost), beside Share link to /c/<id>; Edit needs
 * log_cost, as changing a contractor does. An archived contractor still opens, from a
 * visit or a link, with an Archived tag and no Log service. Under View as, nothing
 * changes anything or leads anywhere.
 */
const TABS = [undefined, 'invoices'] as const
const SHOWN = 6

export function ContractorScreen() {
  const { id = '', tab } = useParams()
  const seeContractors = useRight('see_contractors')
  const seeCosts = !!useRight('see_costs')
  const { data, isPending, isError, refetch } = useContractor(id, seeCosts)
  const back = <BackBar to="/ops/contractors" label="Back to contractors" />

  if (seeContractors === false) return <NotFoundScreen />
  if (isPending)
    return (
      <Screen>
        {back}
        <ScreenBody className="pb-6 pt-1">
          <DetailSkeleton keys={['Contact', 'Phone', 'Email', 'Insurance', 'Notes']} />
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
            title="We couldn't load this contractor"
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
  if (!TABS.includes(tab as (typeof TABS)[number]) || (tab && !seeCosts))
    return <Navigate to={`/ops/contractors/${id}`} replace />
  return <Detail data={data} tab={tab} seeCosts={seeCosts} />
}

function Detail({ data, tab, seeCosts }: { data: ContractorData; tab?: string; seeCosts: boolean }) {
  const { viewingAs } = useUser()
  const scope = useRestaurantScope()
  const canEdit = !!useRight('log_cost') && !viewingAs
  const [year] = useState(() => new Date().getFullYear())
  const { contractor: c } = data
  const here = `/ops/contractors/${c.id}`
  const s = summarizeVisits(data.visits, scope.ids, year)
  const warning = insuranceWarning(c.insurance_until)
  const insurance = c.insurance_until ? insuranceLine(c.insurance_until) : null
  const tel = c.phone?.replace(/[^\d+]/g, '')
  const mailto = mailtoHref(c.email)

  return (
    <Screen>
      <BackBar
        to="/ops/contractors"
        label="Back to contractors"
        action={
          viewingAs ? undefined : (
            <span className="flex flex-none items-center gap-1">
              {canEdit && (
                <Link
                  to={`${here}/edit`}
                  className="flex min-h-tap flex-none items-center px-2 text-15 font-semibold text-brand hover:text-brand-strong"
                >
                  Edit
                </Link>
              )}
              <ContractorMenu
                id={c.id}
                name={c.name}
                items={canEdit && !c.archived_at ? [{ to: `${here}/service/new`, label: 'Log service' }] : []}
              />
            </span>
          )
        }
      >
        Contractors
      </BackBar>
      <ScreenBody className="gap-3 pb-6 pt-2">
        <div className="flex flex-none flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-26 font-bold leading-tight tracking-[-0.02em]">
            {c.name}
            {c.archived_at && (
              <span className="rounded-tag bg-surface-sunken px-2 py-0.5 font-body text-12 font-bold tracking-normal text-text-secondary">
                Archived
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {c.trades.map((t) => (
              <span key={t.id} className="rounded-tag bg-surface-muted px-2 py-0.5 text-11 font-bold text-text-body">
                {t.name}
              </span>
            ))}
            {c.preferred && (
              <span className="inline-flex items-center gap-[3px] text-11 font-bold text-brand">
                <IconStar />
                Preferred
              </span>
            )}
            {warning && (
              <span className="rounded-tag bg-status-open-bg px-2 py-0.5 text-11 font-bold text-status-open-text">
                {warning}
              </span>
            )}
          </div>
        </div>

        {(tel || mailto) && (
          <div className="flex flex-none gap-2.5">
            {tel && (
              <a href={`tel:${tel}`} aria-label={`Call ${c.name}`} className={buttonClasses('medium', 'flex-1')}>
                <IconPhone size={20} />
                Call
              </a>
            )}
            {mailto && (
              <a href={mailto} aria-label={`Email ${c.name}`} className={buttonClasses('secondary', 'flex-1')}>
                <IconMail size={20} />
                Email
              </a>
            )}
          </div>
        )}

        {seeCosts && (
          <section aria-label={`This year at ${scope.selected?.name ?? 'all restaurants'}`} className="flex-none">
            {scope.selected && (
              <p className="mb-2 flex items-center gap-1.5 text-13 text-text-secondary">
                At
                <RestaurantName variant="meta" name={scope.selected.name} color={scope.selected.color} />
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Kpi wide value={money(s.yearCents)} label={`Spend · ${year}`} />
              <Kpi value={String(s.yearVisits)} label={`Visits · ${year}`} />
              <Kpi small value={s.lastVisit ? serviceDay(s.lastVisit) : 'None yet'} label="Last visit" />
            </div>
          </section>
        )}

        <SectionLabel className="-mb-0.5">Details</SectionLabel>
        <Card className="flex-none px-3.5">
          <KeyValueRow label="Contact">{c.contact_name ?? '—'}</KeyValueRow>
          <KeyValueRow label="Phone">{c.phone ?? '—'}</KeyValueRow>
          <KeyValueRow label="Email">
            <span className="[overflow-wrap:anywhere]">{c.email ?? '—'}</span>
          </KeyValueRow>
          <KeyValueRow label="Insurance">{insurance ?? 'Not on file'}</KeyValueRow>
          {c.notes && (
            <KeyValueRow label="Notes">
              <span className="block py-2.5 font-normal [overflow-wrap:anywhere]">{c.notes}</span>
            </KeyValueRow>
          )}
        </Card>

        {seeCosts && (
          <>
            <UnderlineTabs
              label="Contractor history"
              className="mt-2 flex-none"
              inert={viewingAs}
              items={[
                { to: here, label: `Visits · ${s.visits.length}`, end: true },
                {
                  to: `${here}/invoices`,
                  label: (
                    <>
                      Invoices
                      {s.missing > 0 && (
                        <span className="rounded-pill bg-status-waiting-bg px-[7px] py-0.5 text-11 font-bold text-status-waiting-text">
                          {s.missing} missing
                        </span>
                      )}
                    </>
                  ),
                },
              ]}
            />
            {tab === 'invoices' ? (
              <Invoices visits={s.visits} missing={s.missing} />
            ) : (
              <Visits
                visits={s.visits}
                logTo={canEdit && !c.archived_at ? `${here}/service/new` : null}
                name={c.name}
              />
            )}
          </>
        )}
      </ScreenBody>
    </Screen>
  )
}

/** The board's 12px-radius figure: 22px Archivo (17px for a date) over a 12px label. */
function Kpi({ value, label, wide, small }: { value: string; label: string; wide?: boolean; small?: boolean }) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 rounded-input border border-border bg-surface px-3.5 py-3 ${wide ? 'col-span-2' : ''}`}
    >
      <b className={`font-display font-bold [overflow-wrap:anywhere] ${small ? 'text-17 leading-[26px]' : 'text-22'}`}>
        {value}
      </b>
      <span className="text-12 font-semibold text-text-secondary">{label}</span>
    </div>
  )
}

/** A row opening the service record, which comes back here. */
function VisitLink({ visit, children }: { visit: Visit; children: ReactNode }) {
  const location = useLocation()
  const { viewingAs } = useUser()
  const cls =
    'flex items-center gap-3 border-t border-border px-3.5 py-[11px] text-text first:border-t-0 transition-colors'
  return viewingAs ? (
    <div className={cls}>{children}</div>
  ) : (
    <Link
      to={`/ops/service/${visit.id}`}
      state={{ from: location.pathname }}
      className={`${cls} hover:bg-surface-hover active:bg-surface-muted active:duration-0`}
    >
      {children}
    </Link>
  )
}

function Visits({ visits, logTo, name }: { visits: Visit[]; logTo: string | null; name: string }) {
  const [all, setAll] = useState(false)
  if (visits.length === 0)
    return (
      <EmptyState
        titleSize={20}
        icon={<IconReceipt size={30} />}
        title="No visits yet"
        body={`Visits you log with ${name} show up here, with what each one cost.`}
      >
        {logTo && (
          <ButtonLink to={logTo} variant="medium" className="w-full" icon={<IconPlus size={18} strokeWidth={2.2} />}>
            Log service
          </ButtonLink>
        )}
      </EmptyState>
    )
  const shown = all ? visits : visits.slice(0, SHOWN)
  return (
    <>
      <ListCard className="flex-none">
        {shown.map((v) => (
          <VisitLink key={v.id} visit={v}>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-12 font-semibold text-text-secondary">{serviceDay(v.service_date)}</span>
              <span className="text-15 font-semibold [overflow-wrap:anywhere]">{v.title}</span>
              {v.equipment && <span className="text-12 text-text-muted">{v.equipment.name}</span>}
              {v.restaurant && <RestaurantName variant="meta" name={v.restaurant.name} color={v.restaurant.color} />}
            </span>
            <span className="flex-none font-mono text-14 font-medium">{money(v.totalCents)}</span>
            <IconChevronRight size={16} className="flex-none text-text-muted" />
          </VisitLink>
        ))}
      </ListCard>
      {!all && visits.length > SHOWN && (
        <Button variant="ghost" className="flex-none self-center" onClick={() => setAll(true)}>
          Show all {visitsLabel(visits.length)}
        </Button>
      )}
    </>
  )
}

function Invoices({ visits, missing }: { visits: Visit[]; missing: number }) {
  if (visits.length === 0)
    return (
      <EmptyState
        titleSize={20}
        icon={<IconFile size={30} />}
        title="No invoices yet"
        body="Each visit you log shows here with its invoice, or as missing until one is attached."
      />
    )
  return (
    <>
      {missing > 0 && (
        <div className="flex flex-none items-start gap-2.5 rounded-input bg-reopened-banner-bg px-3 py-2.5 text-13 leading-[1.45] text-reopened-banner-text">
          <IconWarning size={18} className="mt-px flex-none text-status-waiting-text" />
          <span>
            <b>
              {visitsLabel(missing)} {missing === 1 ? 'has' : 'have'} no invoice.
            </b>{' '}
            Open the visit to attach it.
          </span>
        </div>
      )}
      <ListCard className="flex-none">
        {visits.map((v) => (
          <VisitLink key={v.id} visit={v}>
            <InvoiceMark isMissing={v.invoiceMissing} missing={<IconWarning size={16} />} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-15 font-semibold [overflow-wrap:anywhere]">
                {v.invoiceMissing ? 'Missing invoice' : (v.invoiceNumber ?? 'Invoice on file')}
              </span>
              {v.restaurant && <RestaurantName variant="meta" name={v.restaurant.name} color={v.restaurant.color} />}
              <span className="text-12 text-text-muted">
                {serviceDay(v.service_date)}
                {v.ticket?.display_id && (
                  <>
                    {' · '}
                    <span className="font-mono">{v.ticket.display_id}</span>
                  </>
                )}
              </span>
            </span>
            <span className="flex-none font-mono text-14 font-medium">{money(v.totalCents)}</span>
          </VisitLink>
        ))}
      </ListCard>
    </>
  )
}
