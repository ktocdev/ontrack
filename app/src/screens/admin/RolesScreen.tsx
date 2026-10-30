import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { CloseBar, Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconCheck, IconChevronDown, IconHelpCircle } from '../../components/icons'
import type { AppRole } from '../../lib/supabase'
import { AdminHeader } from './AdminHeader'
import { changedCells, countPeople } from './rightsDraft'
import {
  defaultKey,
  GRID_ROLES,
  RIGHTS,
  useRoleDefaults,
  useSaveDefaults,
  type DefaultChange,
  type RightKey,
} from './useRights'

/**
 * Admin · Roles & rights (design/screens/Admin-Roles): the default rights of each
 * role, and /admin/roles/edit, where a cell changes with a tap and Save confirms
 * who it affects. Editing has its own route because the board swaps the tab bar
 * for the save buttons. Admin rights are locked, in the database as well. The
 * board says people are notified; that waits for notifications in Phase 3.
 */
const ROLE_HEAD: Record<AppRole, string> = { manager: 'Mgr', ops: 'Ops', leadership: 'Lead', admin: 'Admin' }

const cellText = (key: RightKey, on: boolean) => (key === 'see_all_tickets' ? (on ? 'All' : 'Own') : on ? 'Yes' : 'No')

function CellMark({ rightKey, on }: { rightKey: RightKey; on: boolean }) {
  if (rightKey === 'see_all_tickets') {
    return <span className="text-11 font-bold text-status-progress-text">{on ? 'All' : 'Own'}</span>
  }
  return on ? (
    <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-tag bg-brand-fill text-on-brand">
      <IconCheck size={14} strokeWidth={3} />
    </span>
  ) : (
    <span className="inline-block h-0.5 w-3 bg-border-muted align-middle" />
  )
}

function Grid({
  value,
  saved,
  onTap,
}: {
  value: (role: AppRole, key: RightKey) => boolean
  saved?: (role: AppRole, key: RightKey) => boolean
  /** Present while editing. */
  onTap?: (role: AppRole, key: RightKey) => void
}) {
  return (
    <div className="flex-none overflow-hidden rounded-card border border-border bg-surface">
      <table className="w-full border-collapse text-13">
        <thead>
          <tr>
            <th
              scope="col"
              className="py-2.5 pl-3.5 pr-0.5 text-left text-11 font-bold tracking-[.02em] text-text-secondary"
            >
              Right
            </th>
            {GRID_ROLES.map((role) => (
              <th
                key={role}
                scope="col"
                className="px-0.5 py-2.5 text-11 font-bold tracking-[.02em] text-text-secondary"
              >
                {ROLE_HEAD[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RIGHTS.map(({ key, name }) => (
            <tr key={key}>
              <td className="border-t border-surface-muted py-[11px] pl-3.5 pr-0.5 font-medium text-text">{name}</td>
              {GRID_ROLES.map((role) => {
                const on = value(role, key)
                if (!onTap) {
                  return (
                    <td key={role} className="border-t border-surface-muted px-0.5 py-[11px] text-center">
                      <span role="img" aria-label={cellText(key, on)} className="inline-flex items-center">
                        <CellMark rightKey={key} on={on} />
                      </span>
                    </td>
                  )
                }
                const locked = role === 'admin'
                const changed = saved?.(role, key) !== on
                return (
                  <td key={role} className="border-t border-surface-muted px-0.5 py-1 text-center">
                    <button
                      type="button"
                      aria-disabled={locked}
                      aria-label={`${name}, ${ROLE_HEAD[role]}: ${cellText(key, on)}${locked ? ', locked' : ', tap to change'}`}
                      onClick={() => !locked && onTap(role, key)}
                      className={`inline-flex h-10 w-11 items-center justify-center rounded-control border transition-colors active:duration-0 ${
                        changed ? 'border-brand bg-brand-tint-soft' : 'border-transparent'
                      } ${locked ? 'cursor-not-allowed opacity-55' : 'hover:bg-bg active:bg-surface-muted'}`}
                    >
                      <CellMark rightKey={key} on={on} />
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Help() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex-none">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 items-center gap-1.5 text-13 font-semibold text-brand"
      >
        <IconHelpCircle />
        Help
        <IconChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pb-1.5 pt-0.5 text-13 leading-[1.45] text-text-body">
          <span>
            <b>Mgr</b> Restaurant manager
          </span>
          <span>
            <b>Ops</b> Operations manager
          </span>
          <span>
            <b>Lead</b> Leadership (read-only)
          </span>
          <span>
            <b>Own</b> Only the restaurants assigned to them
          </span>
          <span>
            <b>All</b> Every restaurant in the company
          </span>
          <span className="pt-1.5">
            Changing a default updates everyone with that role, except people with a personal override for that right.
          </span>
          <span>Admin rights can&apos;t be changed, so there&apos;s always someone who can manage access.</span>
        </div>
      )}
    </div>
  )
}

const INTRO = 'Defaults for each role. Override for one person from their user profile.'

export function RolesScreen() {
  const { data, isPending } = useRoleDefaults()
  return (
    <Screen>
      <AdminHeader title="Roles & rights">
        <p className="-mt-1.5 text-14 leading-[1.45] text-text-secondary">{INTRO}</p>
      </AdminHeader>
      <ScreenBody className="gap-3 pb-4 pt-1">
        {isPending || !data ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            <Grid value={(role, key) => data.defaults.get(defaultKey(role, key)) ?? false} />
            <Help />
            <ButtonLink to="/admin/roles/edit" variant="secondary" className="flex-none">
              Edit defaults
            </ButtonLink>
          </>
        )}
      </ScreenBody>
    </Screen>
  )
}

export function EditRolesScreen() {
  const { data, isPending } = useRoleDefaults()
  if (isPending || !data) {
    return (
      <Screen>
        <CloseBar to="/admin/roles" title="Roles & rights" />
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      </Screen>
    )
  }
  return <EditForm defaults={data.defaults} people={data.people} />
}

function EditForm({ defaults, people }: { defaults: Map<string, boolean>; people: Map<AppRole, number> }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveDefaults()
  const [draft, setDraft] = useState(new Map<string, boolean>())
  const [confirming, setConfirming] = useState(false)

  const saved = (role: AppRole, key: RightKey) => defaults.get(defaultKey(role, key)) ?? false
  const value = (role: AppRole, key: RightKey) => draft.get(defaultKey(role, key)) ?? saved(role, key)

  const cells = RIGHTS.flatMap(({ key, name }) =>
    GRID_ROLES.map((role) => ({ id: defaultKey(role, key), role, key, name })),
  )
  const changes = changedCells(cells, (c) => saved(c.role, c.key), draft)
  const affected = [...new Set(changes.map((c) => c.cell.role))].reduce((sum, r) => sum + (people.get(r) ?? 0), 0)

  const submit = () => {
    const payload: DefaultChange[] = changes.map((c) => ({ role: c.cell.role, key: c.cell.key, allowed: c.allowed }))
    save.mutate(payload, {
      onSuccess: () => {
        toast.show('Defaults updated.')
        navigate('/admin/roles')
      },
    })
  }

  return (
    <Screen>
      <CloseBar to="/admin/roles" title="Roles & rights" />
      <ScreenBody className="gap-3 pb-4 pt-3">
        <div
          role="status"
          className="flex-none rounded-input bg-brand-tint-soft px-3 py-2.5 text-13 leading-[1.45] text-brand-strong"
        >
          Tap a cell to change it. See tickets switches between Own and All. Admin rights are locked.
        </div>
        <Grid
          value={value}
          saved={saved}
          onTap={(role, key) => setDraft((d) => new Map(d).set(defaultKey(role, key), !value(role, key)))}
        />
        <Help />
      </ScreenBody>
      <ScreenFooter>
        <Button disabled={changes.length === 0} onClick={() => setConfirming(true)}>
          {changes.length === 0
            ? 'Save changes'
            : `Save ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`}
        </Button>
        <ButtonLink to="/admin/roles" variant="secondary">
          Cancel
        </ButtonLink>
      </ScreenFooter>
      <Sheet
        open={confirming}
        onOpenChange={setConfirming}
        title={`Update defaults for ${countPeople(affected)}?`}
        description="People with a personal override for a changed right keep their override."
      >
        <div className="overflow-hidden rounded-input border border-border bg-surface">
          {changes.map(({ cell, allowed }) => (
            <div
              key={cell.id}
              className="flex items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-14 first:border-t-0"
            >
              <span className="flex-1">
                {cell.name} · {ROLE_HEAD[cell.role]}
              </span>
              <span className="whitespace-nowrap font-mono text-12 font-medium text-text-secondary">
                {cellText(cell.key, !allowed)} → {cellText(cell.key, allowed)}
              </span>
            </div>
          ))}
        </div>
        <Button loading={save.isPending} onClick={submit}>
          Save defaults
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          Keep editing
        </Button>
        {save.isError && (
          <span role="alert" className="text-13 font-semibold text-danger">
            That didn&apos;t go through. Check your connection and try again.
          </span>
        )}
      </Sheet>
    </Screen>
  )
}
