import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'
import { CloseBar, Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { useToast } from '../../components/Toast'
import { IconMail } from '../../components/icons'
import { useUser } from '../../auth/context'
import { looksLikeEmail } from '../../auth/validation'
import { FunctionError } from '../../lib/functions'
import { AccessFields, useAccessChoice } from './AccessFields'
import { useSendInvite } from './useUsers'

/**
 * Admin · Invite user (design/screens/Admin-Invite). Name, work email, role and
 * the restaurants they get. Add restaurant links here with its new restaurant
 * already picked. The board says invites last 7 days; they last 72 hours.
 */

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
  const access = useAccessChoice(restaurants, {
    role: 'manager',
    picked: preset && restaurants.some((r) => r.id === preset) ? [preset] : [],
    all: false,
  })

  // An error is about what was sent, so it goes as soon as that changes.
  const clearError = () => {
    if (send.isError) send.reset()
  }

  const ready = name.trim() !== '' && looksLikeEmail(email) && access.ready
  const code = send.error instanceof FunctionError ? send.error.code : send.error ? 'server_error' : null
  const emailError = code ? EMAIL_ERRORS[code] : undefined
  const formError = code && !emailError ? (FORM_ERRORS[code] ?? 'Something went wrong. Try again.') : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    send.mutate(
      { fullName: name.trim(), email: email.trim(), role: access.role, restaurantIds: access.restaurantIds },
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
      <form onSubmit={submit} onChange={clearError} className="flex min-h-0 flex-1 flex-col" noValidate>
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
          <AccessFields choice={access} restaurants={restaurants} onEdit={clearError} />
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
