import { useState } from 'react'
import { Chip } from '../../components/Chip'
import { RadioCard } from '../../components/RadioCard'
import type { Restaurant } from '../../auth/types'
import type { AppRole } from '../../lib/supabase'

/**
 * Role and restaurants, as on Invite user and the User profile's Change sheet. A
 * manager must have at least one restaurant, so for them All restaurants means
 * each one by name; any other role with All gets the all-restaurants scope, which
 * also covers restaurants added later.
 */
export const ROLE_CHOICES: { value: AppRole; name: string; desc: string }[] = [
  { value: 'manager', name: 'Restaurant manager', desc: 'Creates tickets for their restaurant(s)' },
  { value: 'ops', name: 'Operations manager', desc: 'Works tickets, logs costs and contractors' },
  { value: 'leadership', name: 'Leadership', desc: 'Read-only view of everything' },
  { value: 'admin', name: 'Admin / IT', desc: 'Full access, manages users and rights' },
]

export function useAccessChoice(restaurants: Restaurant[], initial: { role: AppRole; picked: string[]; all: boolean }) {
  const [role, setRole] = useState(initial.role)
  const [picked, setPicked] = useState(initial.picked)
  const [all, setAll] = useState(initial.all)

  return {
    role,
    picked,
    all,
    ready: all || picked.length > 0,
    /** What to save: the restaurants by id, or none for the all-restaurants scope. */
    restaurantIds: all ? (role === 'manager' ? restaurants.map((r) => r.id) : []) : picked,
    pickRole: (next: AppRole) => {
      setRole(next)
      // Everyone but a manager usually sees every restaurant; a choice already made stays.
      if (next !== 'manager' && picked.length === 0) setAll(true)
      if (next === 'manager' && all && picked.length === 0) setAll(false)
    },
    toggle: (id: string) => {
      setAll(false)
      setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
    },
    toggleAll: () => {
      setPicked([])
      setAll((a) => !a)
    },
  }
}

export function AccessFields({
  choice,
  restaurants,
  onEdit,
}: {
  choice: ReturnType<typeof useAccessChoice>
  restaurants: Restaurant[]
  /** Called before any change, so a form can clear its last error. */
  onEdit?: () => void
}) {
  const edit =
    <T,>(apply: (value: T) => void) =>
    (value: T) => {
      onEdit?.()
      apply(value)
    }
  return (
    <>
      <div className="flex flex-col gap-2">
        <span id="access-role" className="text-13 font-semibold text-text-body">
          Role
        </span>
        <div role="radiogroup" aria-labelledby="access-role" className="flex flex-col gap-2">
          {ROLE_CHOICES.map((r) => (
            <RadioCard
              key={r.value}
              checked={choice.role === r.value}
              title={r.name}
              subtitle={r.desc}
              onSelect={() => edit(choice.pickRole)(r.value)}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-13 font-semibold text-text-body">
          {choice.role === 'manager' ? 'Restaurants they manage' : 'Restaurants they can see'}
        </span>
        <div className="flex flex-wrap gap-2">
          {restaurants.map((r) => (
            <Chip
              key={r.id}
              tone="pick"
              selected={choice.picked.includes(r.id)}
              onClick={() => edit(choice.toggle)(r.id)}
            >
              {r.name}
            </Chip>
          ))}
          <Chip tone="pick" selected={choice.all} onClick={() => edit(choice.toggleAll)(undefined)}>
            All restaurants
          </Chip>
        </div>
      </div>
    </>
  )
}
