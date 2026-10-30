import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { GROUP_KEY, groupLabel, useGroup } from '../../auth/group'
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

/**
 * The group's name and the profile photo switch, on Roles & rights. No board draws
 * them, so they follow the settings row and confirm sheet from the kit. Both go through
 * a database function that checks for an admin and logs; off is enforced there too.
 */
export function GroupSettings() {
  const group = useGroup()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
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
          title="Profile photos"
          subtitle={group.profile_photos ? 'People can add a photo' : 'Off · everyone shows initials'}
          trailing={
            <Switch label="Profile photos" checked={group.profile_photos} onCheckedChange={() => setConfirming(true)} />
          }
        />
      </ListCard>
      {editing && <NameSheet group={group} onClose={() => setEditing(false)} />}
      {confirming && <PhotosSheet on={group.profile_photos} onClose={() => setConfirming(false)} />}
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
