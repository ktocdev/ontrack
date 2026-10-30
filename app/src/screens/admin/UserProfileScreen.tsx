import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Button, ButtonLink } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { Switch } from '../../components/Switch'
import { useToast } from '../../components/Toast'
import { IconChevronLeft, IconEye, IconShieldCheck } from '../../components/icons'
import { useUser } from '../../auth/context'
import { firstName } from '../../auth/session'
import { FunctionError } from '../../lib/functions'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useAvatarUrl } from '../profile/useProfile'
import { useRequestReset } from '../reset/useReset'
import { AccessFields, ROLE_CHOICES, useAccessChoice } from './AccessFields'
import { countRights, overrideFor } from './rightsDraft'
import {
  defaultKey,
  PERSON_RIGHTS,
  useDeletePerson,
  usePerson,
  useRoleDefaults,
  useSavePersonRights,
  useSetDeactivated,
  useSetPersonAccess,
  type RightKey,
} from './useRights'

/**
 * Admin · User profile (design/screens/Admin-User-Override): role and restaurants,
 * View as, per-person rights, and sign-in. A switch that matches the role's
 * default stores no override, so later changes to the default still reach them.
 * The board's 2-step row arrives with OT-13; its "Signed in on" row and "Last
 * changed" date wait for data Supabase doesn't give the app, and "is notified"
 * waits for notifications. Deactivate and Delete have no board, so they follow the
 * confirm-sheet pattern at the bottom. Admins' rights are locked.
 */
export function UserProfileScreen() {
  const { id = '' } = useParams()
  const person = usePerson(id)
  const defaults = useRoleDefaults()
  if (person.isPending || defaults.isPending || !defaults.data) {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      </Screen>
    )
  }
  if (!person.data) return <NotFoundScreen />
  return (
    // Keyed on what is saved, so a saved or reset draft starts clean.
    <ProfileForm
      key={[...person.data.overrides].join() + person.data.profile.role}
      id={id}
      person={person.data}
      roleDefaults={defaults.data.defaults}
    />
  )
}

type Person = NonNullable<ReturnType<typeof usePerson>['data']>

function ProfileForm({ id, person, roleDefaults }: { id: string; person: Person; roleDefaults: Map<string, boolean> }) {
  const { user, restaurants } = useUser()
  const { profile } = person
  const toast = useToast()
  const photo = useAvatarUrl(profile.avatar_path)
  const save = useSavePersonRights(id)
  const reset = useRequestReset()

  const first = firstName(profile.full_name) ?? profile.full_name
  const isAdminTarget = profile.role === 'admin'
  const isYou = profile.id === user.id
  const deactivated = profile.deactivated_at !== null
  const roleName = ROLE_CHOICES.find((r) => r.value === profile.role)?.name ?? profile.role

  const [draft, setDraft] = useState(new Map<RightKey, boolean>())
  const [changing, setChanging] = useState(false)
  const [sheet, setSheet] = useState<'deactivate' | 'delete' | null>(null)

  const roleDefault = (key: RightKey) => roleDefaults.get(defaultKey(profile.role, key)) ?? false
  const savedValue = (key: RightKey) => person.overrides.get(key) ?? roleDefault(key)
  const value = (key: RightKey) => draft.get(key) ?? savedValue(key)

  const overridden = PERSON_RIGHTS.filter((r) => value(r.key) !== roleDefault(r.key)).length
  const changes = PERSON_RIGHTS.filter((r) => value(r.key) !== savedValue(r.key))
  const scope = person.allRestaurants
    ? 'All restaurants'
    : restaurants
        .filter((r) => person.restaurantIds.includes(r.id))
        .map((r) => r.name)
        .join(', ') || 'No restaurant yet'
  const seesAll = roleDefault('see_all_tickets')

  const submit = () =>
    save.mutate(
      changes.map((r) => ({ key: r.key, allowed: overrideFor(value(r.key), roleDefault(r.key)) })),
      { onSuccess: () => toast.show(`${first}'s rights saved.`) },
    )

  return (
    <Screen>
      <div className="flex flex-none items-center gap-1 border-b border-border pb-2 pl-3 pr-3 pt-[calc(12px+var(--safe-top))]">
        <Link
          to="/admin/users"
          aria-label="Back to users"
          className="flex h-11 w-11 items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
        >
          <IconChevronLeft size={22} />
        </Link>
        <span className="eyebrow">Admin · User profile</span>
      </div>

      <ScreenBody className="gap-3 pb-4 pt-3">
        <div className="flex flex-none items-center gap-3.5">
          <Avatar name={profile.full_name} role={profile.role} size={52} src={photo.data} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="font-display text-24 font-bold tracking-[-0.02em]">{profile.full_name}</h1>
            <span className="text-13 text-text-secondary [overflow-wrap:anywhere]">{profile.email}</span>
          </div>
        </div>

        {deactivated && (
          <div
            role="status"
            className="flex-none rounded-input bg-status-waiting-bg px-3 py-2.5 text-13 leading-[1.45] text-status-waiting-text"
          >
            {first} is deactivated and can&apos;t sign in. Their name stays on their history.
          </div>
        )}

        <div className="flex flex-none items-center gap-3 rounded-input border border-border bg-surface px-3.5 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-12 font-semibold text-text-secondary">Role</span>
            <span className="text-15 font-semibold">{roleName}</span>
            <span className="text-14 leading-[1.35] text-text-body [overflow-wrap:anywhere]">{scope}</span>
          </div>
          {!isYou && !deactivated && (
            <Button variant="ghost" onClick={() => setChanging(true)}>
              Change
            </Button>
          )}
        </div>

        {!isYou && !isAdminTarget && !deactivated && (
          <>
            <ButtonLink to={`/admin/users/${id}/view`} variant="secondary" className="flex-none" icon={<IconEye />}>
              View as {first}
            </ButtonLink>
            <span className="-mt-1.5 flex-none text-center text-12 text-text-secondary">
              See {first}&apos;s screens as they appear to {first}. Read-only.
            </span>
          </>
        )}

        {overridden > 0 && (
          <div className="flex flex-none items-start gap-2.5 rounded-input bg-status-progress-bg px-3 py-2.5 text-13 leading-[1.45] text-status-progress-text">
            <IconShieldCheck size={18} className="mt-px flex-none" />
            <span>
              <b>{countRights(overridden)}</b> {overridden === 1 ? 'differs' : 'differ'} from {roleName} defaults.
              Overrides stay if the role defaults change.
            </span>
          </div>
        )}

        <div className="flex flex-none items-center justify-between pt-3">
          <SectionLabel className="!pt-0">Rights for {first}</SectionLabel>
          {!isAdminTarget && (
            <button
              type="button"
              disabled={overridden === 0}
              onClick={() => setDraft(new Map(PERSON_RIGHTS.map((r) => [r.key, roleDefault(r.key)])))}
              className="-my-1 min-h-tap px-1 text-13 font-semibold text-status-progress-text disabled:text-text-muted"
            >
              Reset all to role
            </button>
          )}
        </div>
        <ListCard className="-mt-1 flex-none">
          <div className="flex min-h-[54px] items-center gap-2.5 px-3.5 py-1.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-14 font-semibold">See tickets</span>
              <span className="text-12 text-text-secondary">
                Role default: {seesAll ? 'all restaurants' : 'own restaurants'}
              </span>
            </div>
            <span className="text-right text-13 font-semibold text-status-progress-text">
              {seesAll ? 'All restaurants' : scope}
            </span>
          </div>
          {PERSON_RIGHTS.map(({ key, name }) => {
            const on = value(key)
            const def = roleDefault(key)
            const isOverride = on !== def
            return (
              <div
                key={key}
                className={`flex min-h-[54px] items-center gap-2.5 border-t border-border px-3.5 py-1.5 ${isOverride ? 'bg-info-tint-faint' : ''}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-[3px] text-14 font-semibold leading-[1.35]">
                    {name}
                    {isOverride && (
                      <span className="whitespace-nowrap rounded-chip bg-status-progress-bg px-1.5 py-0.5 text-[10px] font-bold uppercase leading-[1.3] tracking-[.04em] text-status-progress-text">
                        Override
                      </span>
                    )}
                  </span>
                  <span className="text-12 text-text-secondary">Role default: {def ? 'on' : 'off'}</span>
                </div>
                {isOverride && (
                  <button
                    type="button"
                    aria-label={`Reset ${name} to role default`}
                    onClick={() => setDraft((d) => new Map(d).set(key, def))}
                    className="-my-1 min-h-tap px-1 text-13 font-semibold text-status-progress-text"
                  >
                    Reset
                  </button>
                )}
                <Switch
                  label={name}
                  checked={on}
                  disabled={isAdminTarget}
                  onCheckedChange={(next) => setDraft((d) => new Map(d).set(key, next))}
                />
              </div>
            )
          })}
        </ListCard>
        {isAdminTarget && (
          <span className="-mt-1 flex-none text-12 text-text-secondary">
            Admin rights can&apos;t be changed, so there&apos;s always someone who can manage access.
          </span>
        )}

        <SectionLabel className="flex-none">Sign-in &amp; security</SectionLabel>
        <ListCard className="-mt-1 flex-none">
          <div className="flex min-h-[60px] items-center gap-3 px-3.5 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-14 font-semibold">Password</span>
              <span className={`text-12 ${reset.isError ? 'font-semibold text-danger' : 'text-text-secondary'}`}>
                {reset.isError
                  ? "Couldn't send that. Wait a minute and try again."
                  : reset.isSuccess
                    ? `Reset link sent to ${first}.`
                    : `Emails ${first} a link to choose a new one`}
              </span>
            </div>
            <Button
              variant="ghost"
              loading={reset.isPending}
              disabled={deactivated}
              onClick={() => reset.mutate(profile.email)}
            >
              Send reset link
            </Button>
          </div>
        </ListCard>

        {!isYou && (
          <>
            <SectionLabel className="flex-none">Access</SectionLabel>
            <div className="-mt-1 flex flex-none flex-col gap-2">
              <Button variant="secondary-danger" onClick={() => setSheet('deactivate')}>
                {deactivated ? `Reactivate ${first}` : `Deactivate ${first}`}
              </Button>
              <Button variant="secondary-danger" disabled={person.hasHistory} onClick={() => setSheet('delete')}>
                Delete account
              </Button>
              {person.hasHistory && (
                <span className="text-13 text-text-secondary">
                  {first} has tickets, invites or other history, so this account can only be deactivated.
                </span>
              )}
            </div>
          </>
        )}
      </ScreenBody>

      {!isAdminTarget && (
        <ScreenFooter>
          {save.isError && (
            <span role="alert" className="text-13 font-semibold text-danger">
              Couldn&apos;t save. Check your connection and try again.
            </span>
          )}
          <Button loading={save.isPending} disabled={changes.length === 0} onClick={submit}>
            Save changes
          </Button>
          <span className="text-center text-12 text-text-secondary">Rights change as soon as you save.</span>
        </ScreenFooter>
      )}

      {changing && <AccessSheet id={id} person={person} first={first} onClose={() => setChanging(false)} />}
      {sheet && (
        <AccountSheet id={id} mode={sheet} first={first} deactivated={deactivated} onClose={() => setSheet(null)} />
      )}
    </Screen>
  )
}

function AccessSheet({
  id,
  person,
  first,
  onClose,
}: {
  id: string
  person: Person
  first: string
  onClose: () => void
}) {
  const { restaurants } = useUser()
  const set = useSetPersonAccess(id)
  const toast = useToast()
  const choice = useAccessChoice(restaurants, {
    role: person.profile.role,
    picked: person.allRestaurants ? [] : person.restaurantIds,
    all: person.allRestaurants,
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Change ${first}'s role`}
      description="This changes what they can see and do as soon as you save. Personal overrides stay."
    >
      <AccessFields choice={choice} restaurants={restaurants} onEdit={() => set.isError && set.reset()} />
      <Button
        loading={set.isPending}
        disabled={!choice.ready}
        onClick={() =>
          set.mutate(
            { role: choice.role, restaurantIds: choice.restaurantIds },
            {
              onSuccess: () => {
                toast.show(`${first}'s role saved.`)
                onClose()
              },
            },
          )
        }
      >
        Save role
      </Button>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      {set.isError && (
        <span role="alert" className="text-13 font-semibold text-danger">
          That didn&apos;t go through. Check your connection and try again.
        </span>
      )}
    </Sheet>
  )
}

const ACCOUNT_ERRORS: Record<string, string> = {
  has_history: 'This account has history now, so it can only be deactivated.',
  not_yourself: "You can't do that to your own account.",
  admin_only: 'Only an admin can do that.',
}

function AccountSheet({
  id,
  mode,
  first,
  deactivated,
  onClose,
}: {
  id: string
  mode: 'deactivate' | 'delete'
  first: string
  deactivated: boolean
  onClose: () => void
}) {
  const setOff = useSetDeactivated(id)
  const remove = useDeletePerson(id)
  const toast = useToast()
  const navigate = useNavigate()
  const error = setOff.error ?? remove.error
  const message = error
    ? (error instanceof FunctionError && ACCOUNT_ERRORS[error.code]) ||
      "That didn't go through. Check your connection and try again."
    : null

  const title =
    mode === 'delete' ? `Delete ${first}'s account?` : deactivated ? `Reactivate ${first}?` : `Deactivate ${first}?`
  const description =
    mode === 'delete'
      ? 'This removes it for good. It has no tickets or other history, so nothing else is lost.'
      : deactivated
        ? 'They can sign in again with their old password, with the same role and rights.'
        : 'They are signed out and can’t sign in. Their name stays on their history, and you can reactivate them any time. Any restaurant they manage will have no manager.'

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={title} description={description}>
      {mode === 'delete' ? (
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                toast.show(`${first}'s account deleted.`)
                navigate('/admin/users')
              },
            })
          }
        >
          Delete account
        </Button>
      ) : (
        <Button
          variant={deactivated ? 'primary' : 'danger'}
          loading={setOff.isPending}
          onClick={() =>
            setOff.mutate(!deactivated, {
              onSuccess: () => {
                toast.show(deactivated ? `${first} reactivated.` : `${first} deactivated.`)
                onClose()
              },
            })
          }
        >
          {deactivated ? `Reactivate ${first}` : `Deactivate ${first}`}
        </Button>
      )}
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      {message && (
        <span role="alert" className="text-13 font-semibold text-danger">
          {message}
        </span>
      )}
    </Sheet>
  )
}
