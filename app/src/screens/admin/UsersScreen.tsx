import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { ButtonLink } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { Chip } from '../../components/Chip'
import { EmptyState } from '../../components/EmptyState'
import { RoleTag } from '../../components/Pill'
import { Screen, ScreenBody, ScreenEmpty } from '../../components/Screen'
import { PeopleListSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconChevronRight, IconPerson, IconPlus, IconUserPlus } from '../../components/icons'
import { ROLE_LABEL } from '../../app/roles'
import { useUser } from '../../auth/context'
import { useAvatarUrl } from '../profile/useProfile'
import { AdminHeader } from './AdminHeader'
import { InviteSheet } from './InviteSheet'
import { useResendInvite, useUsers, type InviteRow, type PersonRow } from './useUsers'

/**
 * Admin · Users (design/screens/Admin-Users), and its empty state
 * (Empty-Admin-Users) while the admin is the only one here. Invites come first,
 * with Resend on the row; tapping one also offers Revoke. People open their
 * profile. The filters count pending and expired invites together, as the board
 * does.
 */
type Filter = 'all' | 'pending' | 'managers' | 'ops'

export function UsersScreen() {
  const { user } = useUser()
  const { data, isPending } = useUsers()
  const [filter, setFilter] = useState<Filter>('all')
  const [opened, setOpened] = useState<InviteRow | null>(null)

  const invites = data?.invites ?? []
  const people = data?.people ?? []
  const justYou = data && invites.length === 0 && people.every((p) => p.id === user.id)
  const you = people.find((p) => p.id === user.id)

  const shownInvites = invites.filter(
    (i) =>
      filter === 'all' ||
      filter === 'pending' ||
      (filter === 'managers' && i.role === 'manager') ||
      (filter === 'ops' && i.role === 'ops'),
  )
  const shownPeople = people.filter(
    (p) =>
      filter === 'all' || (filter === 'managers' && p.role === 'manager') || (filter === 'ops' && p.role === 'ops'),
  )

  const chips: { value: Filter; label: string }[] = [
    { value: 'all', label: data ? `All · ${invites.length + people.length}` : 'All' },
    { value: 'pending', label: data ? `Pending · ${invites.length}` : 'Pending' },
    { value: 'managers', label: 'Managers' },
    { value: 'ops', label: 'Ops' },
  ]

  if (justYou) {
    return (
      <Screen>
        <AdminHeader title="Users">
          {you && (
            <ListCard>
              <div className={ROW}>
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-surface-muted text-text-body">
                  <IconPerson />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <RowBody name="You" tag={ROLE_LABEL[you.role]} scope={you.scope} />
                </span>
              </div>
            </ListCard>
          )}
        </AdminHeader>
        <ScreenEmpty>
          <EmptyState
            icon={<IconUserPlus size={30} />}
            title="It's just you so far"
            body="Invite restaurant managers to report problems, and your operations team to assign and close tickets."
          >
            <ButtonLink to="/admin/users/new" variant="medium" className="w-full" icon={<IconPlus size={18} />}>
              Invite people
            </ButtonLink>
          </EmptyState>
        </ScreenEmpty>
      </Screen>
    )
  }

  return (
    <Screen>
      <AdminHeader
        title="Users"
        action={
          <ButtonLink to="/admin/users/new" variant="compact" icon={<IconPlus size={18} />}>
            Invite
          </ButtonLink>
        }
      >
        <div className="flex gap-2 overflow-x-auto py-1">
          {chips.map((c) => (
            <Chip key={c.value} selected={filter === c.value} onClick={() => setFilter(c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </AdminHeader>

      <ScreenBody className="pb-4 pt-1">
        {isPending ? (
          <PeopleListSkeleton count={6} />
        ) : shownInvites.length + shownPeople.length === 0 ? (
          <p className="py-10 text-center text-14 text-text-secondary">Nobody here yet.</p>
        ) : (
          <ListCard>
            {shownInvites.map((i) => (
              <InviteRowView key={i.id} invite={i} onOpen={() => setOpened(i)} />
            ))}
            {shownPeople.map((p) => (
              <PersonRowView key={p.id} person={p} />
            ))}
          </ListCard>
        )}
      </ScreenBody>
      {opened && <InviteSheet invite={opened} onClose={() => setOpened(null)} />}
    </Screen>
  )
}

const ROW = 'flex items-center gap-3 border-t border-border px-3.5 py-3 first:border-t-0'

function RowBody({ name, tag, scope, dim }: { name: string; tag: string; scope: string; dim?: boolean }) {
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className={`min-w-0 truncate text-15 font-semibold ${dim ? 'text-text-secondary' : ''}`}>{name}</span>
        <RoleTag>{tag}</RoleTag>
      </span>
      <span className="text-13 leading-[1.35] text-text-secondary [overflow-wrap:anywhere]">{scope}</span>
    </>
  )
}

function PersonRowView({ person: p }: { person: PersonRow }) {
  const photo = useAvatarUrl(p.avatarPath)
  return (
    <Link
      to={`/admin/users/${p.id}`}
      className={`${ROW} text-text no-underline transition-colors hover:bg-surface-hover hover:text-text active:bg-surface-muted active:duration-0`}
    >
      <Avatar name={p.name} role={p.role} size={38} src={photo.data} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <RowBody name={p.name} tag={ROLE_LABEL[p.role]} scope={p.scope} dim={p.deactivated} />
        {p.deactivated && <span className="text-12 font-semibold text-text-muted">Deactivated</span>}
      </span>
      <IconChevronRight size={16} className="flex-none text-text-secondary" />
    </Link>
  )
}

function InviteRowView({ invite: i, onOpen }: { invite: InviteRow; onOpen: () => void }) {
  const resend = useResendInvite()
  const toast = useToast()
  return (
    <div className={`${ROW} relative transition-colors hover:bg-surface-hover`}>
      {/* The whole row opens the sheet; Resend sits above this layer. */}
      <button type="button" onClick={onOpen} aria-label={`${i.name}, invite options`} className="absolute inset-0" />
      <Avatar name={i.name} role={i.expired ? 'expired' : 'pending'} size={38} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <RowBody name={i.name} tag={ROLE_LABEL[i.role]} scope={i.scope} />
        <span className="flex items-center justify-between gap-2">
          <span
            role={resend.isError ? 'alert' : undefined}
            className={`text-12 font-semibold ${
              i.expired || resend.isError ? 'text-status-open-text' : 'text-status-waiting-text'
            }`}
          >
            {resend.isError ? "Couldn't send. Try again." : i.line}
          </span>
          <button
            type="button"
            disabled={resend.isPending}
            onClick={() => resend.mutate(i.id, { onSuccess: () => toast.show(`Invite sent again to ${i.name}.`) })}
            className="relative -mr-1 -my-1 min-h-tap flex-none px-1 text-13 font-semibold text-brand transition-colors hover:text-brand-strong active:text-brand-strong active:duration-0 disabled:opacity-60"
          >
            {resend.isPending ? 'Sending…' : 'Resend'}
          </button>
        </span>
      </div>
    </div>
  )
}
