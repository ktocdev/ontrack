import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ROLE_HEAD, ROLE_LABEL, ROLES, type RoleName } from '../../app/roles'
import { GROUP_KEY, groupLabel, useGroup, useRoleNames } from '../../auth/group'
import type { AppRole } from '../../lib/supabase'
import { ROLE_CHOICES } from './AccessFields'
import { Button } from '../../components/Button'
import { ListCard, ListRow } from '../../components/Card'
import { Input } from '../../components/Field'
import { SectionLabel } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { Switch } from '../../components/Switch'
import { useToast } from '../../components/Toast'
import { requireSupabase } from '../../lib/supabase'

const MAX_NAME = 80
const MAX_SHORT_NAME = 12
const MAX_ROLE_NAME = 30
const MAX_ROLE_SHORT = 8

/**
 * The group's name and the profile photo switch, on Roles & rights. No board draws
 * them, so they follow the settings row and confirm sheet from the kit. Both go through
 * a database function that checks for an admin and logs; off is enforced there too.
 */
export function GroupSettings() {
  const group = useGroup()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [naming, setNaming] = useState(false)
  const roleNames = useRoleNames()
  if (!group) return null
  return (
    <>
      <SectionLabel className="flex-none">Group</SectionLabel>
      <ListCard className="-mt-1 flex-none">
        <ListRow
          title="Group name"
          subtitle={groupLabel(group)}
          trailing={
            <Button variant="ghost" aria-label="Edit group name" onClick={() => setEditing(true)}>
              Edit
            </Button>
          }
        />
        <ListRow
          title="Role names"
          subtitle={ROLES.map((r) => roleNames.name(r)).join(' · ')}
          trailing={
            <Button variant="ghost" aria-label="Edit role names" onClick={() => setNaming(true)}>
              Edit
            </Button>
          }
        />
        <ListRow
          title="Profile photos"
          subtitle={group.profile_photos ? 'People can add a photo' : 'Off · everyone shows initials'}
          trailing={
            <Switch label="Profile photos" checked={group.profile_photos} onCheckedChange={() => setConfirming(true)} />
          }
        />
      </ListCard>
      {editing && <NameSheet group={group} onClose={() => setEditing(false)} />}
      {confirming && <PhotosSheet on={group.profile_photos} onClose={() => setConfirming(false)} />}
      {naming && <RoleNamesSheet named={roleNames.named} onClose={() => setNaming(false)} />}
    </>
  )
}

function useRefreshGroup() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: GROUP_KEY })
}

function NameSheet({ group, onClose }: { group: { name: string; short_name: string | null }; onClose: () => void }) {
  const [name, setName] = useState(group.name)
  const [shortName, setShortName] = useState(group.short_name ?? '')
  const toast = useToast()
  const refresh = useRefreshGroup()
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await requireSupabase().rpc('save_group_name', { p_name: name, p_short_name: shortName })
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    save.mutate(undefined, {
      onSuccess: () => {
        toast.show('Group name saved.')
        onClose()
      },
    })
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit group name"
      description="It shows at the top of the admin screens, on the invite email and while checking an invite."
    >
      <form
        onSubmit={submit}
        onChange={() => {
          if (save.isError) save.reset()
        }}
        className="flex flex-col gap-3.5"
        noValidate
      >
        <Input label="Name" maxLength={MAX_NAME} value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Short name"
          optional
          maxLength={MAX_SHORT_NAME}
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          hint={`Up to ${MAX_SHORT_NAME} characters. Shows before the name, with a line between them.`}
        />
        <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
          Save name
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {save.isError && (
          <span role="alert" className="text-13 font-semibold text-danger">
            That didn&apos;t go through. Check your connection and try again.
          </span>
        )}
      </form>
    </Sheet>
  )
}

function PhotosSheet({ on, onClose }: { on: boolean; onClose: () => void }) {
  const toast = useToast()
  const refresh = useRefreshGroup()
  const set = useMutation({
    mutationFn: async () => {
      const { error } = await requireSupabase().rpc('set_profile_photos', { p_on: !on })
      if (error) throw error
    },
    onSuccess: refresh,
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={on ? 'Turn off profile photos?' : 'Turn on profile photos?'}
      description={
        on
          ? 'Nobody can add or change a photo, and existing ones are hidden, so everyone shows initials. Photos are kept, so turning this back on restores them. People can still remove their own. Ticket and equipment photos are not affected.'
          : "Everyone's saved photos show again, and people can add or change theirs."
      }
    >
      <Button
        variant={on ? 'danger' : 'primary'}
        loading={set.isPending}
        onClick={() =>
          set.mutate(undefined, {
            onSuccess: () => {
              toast.show(on ? 'Profile photos turned off.' : 'Profile photos turned on.')
              onClose()
            },
          })
        }
      >
        {on ? 'Turn off photos' : 'Turn on photos'}
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

/**
 * What each role is called (OT-114): a name, shown wherever the app names the role or
 * beside a person, and a short name for the grid's narrow columns. A role whose words are
 * the defaults is not stored, so each screen keeps the wording its board draws.
 */
function RoleNamesSheet({ named, onClose }: { named: Partial<Record<AppRole, RoleName>>; onClose: () => void }) {
  const [draft, setDraft] = useState<Record<AppRole, RoleName>>(
    () =>
      Object.fromEntries(ROLES.map((r) => [r, named[r] ?? { name: ROLE_LABEL[r], short: ROLE_HEAD[r] }])) as Record<
        AppRole,
        RoleName
      >,
  )
  const toast = useToast()
  const refresh = useRefreshGroup()
  const ready = ROLES.every((r) => draft[r].name.trim() && draft[r].short.trim())
  const save = useMutation({
    mutationFn: async () => {
      const names = Object.fromEntries(
        ROLES.flatMap((r) => {
          const name = draft[r].name.trim()
          const short = draft[r].short.trim()
          return name === ROLE_LABEL[r] && short === ROLE_HEAD[r] ? [] : [[r, { name, short }]]
        }),
      )
      const { error } = await requireSupabase().rpc('save_role_names', { p_names: names })
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const set = (role: AppRole, field: keyof RoleName, value: string) =>
    setDraft((d) => ({ ...d, [role]: { ...d[role], [field]: value } }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    save.mutate(undefined, {
      onSuccess: () => {
        toast.show('Role names saved.')
        onClose()
      },
    })
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit role names"
      description="What each role is called on every screen, and beside a person's name. The short name heads the grid. What each role may do stays the same."
    >
      <form
        onSubmit={submit}
        onChange={() => {
          if (save.isError) save.reset()
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        {ROLES.map((role) => (
          <fieldset key={role} className="flex flex-col gap-2.5">
            <legend className="mb-1 text-13 font-semibold text-text-body">
              {ROLE_CHOICES.find((c) => c.value === role)?.desc}
            </legend>
            <Input
              label="Name"
              maxLength={MAX_ROLE_NAME}
              value={draft[role].name}
              onChange={(e) => set(role, 'name', e.target.value)}
            />
            <Input
              label="Short name"
              maxLength={MAX_ROLE_SHORT}
              value={draft[role].short}
              onChange={(e) => set(role, 'short', e.target.value)}
              hint={`Up to ${MAX_ROLE_SHORT} characters, for the grid.`}
            />
          </fieldset>
        ))}
        <Button type="submit" loading={save.isPending} disabled={!ready}>
          Save names
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {save.isError && (
          <span role="alert" className="text-13 font-semibold text-danger">
            That didn&apos;t go through. Check your connection and try again.
          </span>
        )}
      </form>
    </Sheet>
  )
}
