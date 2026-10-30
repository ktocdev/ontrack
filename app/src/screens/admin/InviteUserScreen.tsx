import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { Input } from '../../components/Field'
import { RadioCard } from '../../components/RadioCard'
import { CloseBar, Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { useToast } from '../../components/Toast'
import { IconMail } from '../../components/icons'
import { useUser } from '../../auth/context'
import { looksLikeEmail } from '../../auth/validation'
import { FunctionError } from '../../lib/functions'
import type { AppRole } from '../../lib/supabase'
import { useSendInvite } from './useUsers'

/**
 * Admin · Invite user (design/screens/Admin-Invite). Name, work email, role and
 * the restaurants they get. A manager must have at least one restaurant, so for
 * them All restaurants means each one by name; any other role with All gets the
 * all-restaurants scope, which also covers restaurants added later. Add
 * restaurant links here with its new restaurant already picked. The board says
 * invites last 7 days; they last 72 hours.
 */
const ROLES: { value: AppRole; name: string; desc: string }[] = [
  { value: 'manager', name: 'Restaurant manager', desc: 'Creates tickets for their restaurant(s)' },
  { value: 'ops', name: 'Operations manager', desc: 'Works tickets, logs costs and contractors' },
  { value: 'leadership', name: 'Leadership', desc: 'Read-only view of everything' },
  { value: 'admin', name: 'Admin / IT', desc: 'Full access, manages users and rights' },
]

const EMAIL_ERRORS: Record<string, string> = {
  email_taken: 'Someone with this email already has an account.',
  already_invited: 'This person already has a pending invite. You can resend it from Users.',
  bad_email: 'Enter a valid email address.',
}

const FORM_ERRORS: Record<string, string> = {
  email_failed: "The invite email couldn't be sent, so nothing was saved. Try again in a moment.",
  not_allowed: "You don't have permission to invite people.",
  admin_only: 'Only an admin can invite someone to this role.',
  outside_your_scope: 'You can only give access to restaurants you have yourself.',
  network: "Can't reach OnTrack. Check your connection and try again.",
}

export function InviteUserScreen() {
  const { restaurants } = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const send = useSendInvite()
  const [params] = useSearchParams()

  const preset = params.get('restaurant')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AppRole>('manager')
  const [picked, setPicked] = useState<string[]>(preset && restaurants.some((r) => r.id === preset) ? [preset] : [])
  const [all, setAll] = useState(false)

  const pickRole = (next: AppRole) => {
    setRole(next)
    // Everyone but a manager usually sees every restaurant; a choice already made stays.
    if (next !== 'manager' && picked.length === 0) setAll(true)
    if (next === 'manager' && all && picked.length === 0) setAll(false)
  }
  const toggle = (id: string) => {
    setAll(false)
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }
  const toggleAll = () => {
    setPicked([])
    setAll((a) => !a)
  }

  const ready = name.trim() !== '' && looksLikeEmail(email) && (all || picked.length > 0)
  const code = send.error instanceof FunctionError ? send.error.code : send.error ? 'server_error' : null
  const emailError = code ? EMAIL_ERRORS[code] : undefined
  const formError = code && !emailError ? (FORM_ERRORS[code] ?? 'Something went wrong. Try again.') : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    const restaurantIds = all ? (role === 'manager' ? restaurants.map((r) => r.id) : []) : picked
    send.mutate(
      { fullName: name.trim(), email: email.trim(), role, restaurantIds },
      {
        onSuccess: () => {
          toast.show(`Invite sent to ${name.trim()}.`)
          navigate('/admin/users')
        },
      },
    )
  }

  return (
    <Screen>
      <CloseBar to="/admin/users" title="Invite a user" bordered={false} />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <ScreenBody className="gap-4 pb-4 pt-3">
          <Input
            label="Full name"
            autoComplete="off"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Work email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <div className="flex flex-col gap-2">
            <span id="invite-role" className="text-13 font-semibold text-text-body">
              Role
            </span>
            <div role="radiogroup" aria-labelledby="invite-role" className="flex flex-col gap-2">
              {ROLES.map((r) => (
                <RadioCard
                  key={r.value}
                  checked={role === r.value}
                  title={r.name}
                  subtitle={r.desc}
                  onSelect={() => pickRole(r.value)}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-13 font-semibold text-text-body">
              {role === 'manager' ? 'Restaurants they manage' : 'Restaurants they can see'}
            </span>
            <div className="flex flex-wrap gap-2">
              {restaurants.map((r) => (
                <Chip key={r.id} tone="pick" selected={picked.includes(r.id)} onClick={() => toggle(r.id)}>
                  {r.name}
                </Chip>
              ))}
              <Chip tone="pick" selected={all} onClick={toggleAll}>
                All restaurants
              </Chip>
            </div>
          </div>
        </ScreenBody>
        <ScreenFooter>
          {formError && (
            <span role="alert" className="text-13 font-semibold text-danger">
              {formError}
            </span>
          )}
          <Button type="submit" icon={<IconMail size={20} />} loading={send.isPending} disabled={!ready}>
            Send invite
          </Button>
          <span className="text-center text-12 text-text-secondary">The invite link expires after 72 hours.</span>
        </ScreenFooter>
      </form>
    </Screen>
  )
}
