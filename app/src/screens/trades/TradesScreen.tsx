import { useState } from 'react'
import { Button } from '../../components/Button'
import { ListCard, ListRow, ListRowButton } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { RoleTag } from '../../components/Pill'
import { BackBar, Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { PeopleListSkeleton } from '../../components/Skeleton'
import { IconChevronRight, IconPlus, IconWarning } from '../../components/icons'
import { AddTradeSheet, TradeSheet } from './TradeSheets'
import { useCanEditTrades, useManagedTrades, type ManagedTrade } from './useTrades'

/**
 * Trades (OT-99; no board draws it, so it follows Categories). The group's list of what
 * contractors do, looked after by Ops with Log cost and by admins (decided Nov 12, 2026):
 * Ops opens it from the menu on Contractors, an admin from Restaurants. The trades on, in
 * the list's order, then the turned-off ones under their own label. A row opens a sheet
 * to rename it, turn it off or on, or delete one no contractor has. Anyone else, and View
 * as, sees the list only.
 */
export function OpsTradesScreen() {
  return <Trades back="/ops/contractors" backLabel="Back to contractors" crumb="Contractors" />
}

export function AdminTradesScreen() {
  return <Trades back="/admin/restaurants" backLabel="Back to restaurants" crumb="Restaurants" />
}

function Trades({ back, backLabel, crumb }: { back: string; backLabel: string; crumb: string }) {
  const canEdit = useCanEditTrades()
  const { data, isPending, isError, refetch } = useManagedTrades()
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<ManagedTrade | null>(null)

  const on = (data ?? []).filter((t) => t.active)
  const off = (data ?? []).filter((t) => !t.active)
  const row = (t: ManagedTrade) => {
    const subtitle = t.inUse ? undefined : 'No contractor has it yet'
    const trailing = !t.active && <RoleTag>Off</RoleTag>
    return canEdit ? (
      <ListRowButton
        key={t.id}
        onClick={() => setSelected(t)}
        title={t.name}
        subtitle={subtitle}
        trailing={
          <span className="flex items-center gap-2">
            {trailing}
            <IconChevronRight className="text-text-muted" />
          </span>
        }
      />
    ) : (
      <ListRow key={t.id} title={t.name} subtitle={subtitle} trailing={trailing || undefined} />
    )
  }

  return (
    <Screen>
      <BackBar to={back} label={backLabel}>
        {crumb}
      </BackBar>
      <ScreenBody className="gap-3.5 pb-6 pt-1">
        <div className="flex flex-none items-center justify-between gap-3">
          <h1 className="font-display text-30 font-bold tracking-[-0.02em]">Trades</h1>
          {canEdit && (
            <Button
              variant="compact"
              aria-label="Add trade"
              icon={<IconPlus size={18} strokeWidth={2.4} />}
              className="gap-1.5 px-3.5 text-14"
              onClick={() => setAdding(true)}
            >
              Add
            </Button>
          )}
        </div>
        <p className="flex-none text-14 leading-normal text-text-secondary">
          What your contractors do, shared by every restaurant. A contractor can have several. Turning one off takes it
          out of the choices; contractors who have it keep it.
        </p>
        {isError ? (
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load trades"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        ) : isPending ? (
          <PeopleListSkeleton count={8} />
        ) : (
          <>
            {on.length > 0 ? (
              <ListCard>{on.map(row)}</ListCard>
            ) : (
              <p className="px-3 py-7 text-center text-14 text-text-body">No trades turned on.</p>
            )}
            {off.length > 0 && (
              <>
                <SectionLabel className="-mb-1.5">Turned off</SectionLabel>
                <ListCard>{off.map(row)}</ListCard>
              </>
            )}
          </>
        )}
      </ScreenBody>
      <AddTradeSheet open={adding} onOpenChange={setAdding} />
      {selected && <TradeSheet trade={selected} onClose={() => setSelected(null)} />}
    </Screen>
  )
}
