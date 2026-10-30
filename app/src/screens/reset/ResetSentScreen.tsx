import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { buttonClasses } from '../../components/Button'
import { BrandBackBar, Screen } from '../../components/Screen'
import { IconClockSmall, IconInbox, IconMail } from '../../components/icons'
import { useRequestReset } from './useReset'

/**
 * Password reset · 2 Check your email (design/screens/Reset-Sent). It never says
 * whether the address has an account. Resend waits out the 60 seconds Auth holds
 * between emails. Open email app goes to Gmail, which the group uses and which
 * opens the app on a phone that has it; mailto: would only start a new message.
 */
const WAIT_SECONDS = 60

export function ResetSentScreen() {
  const email = (useLocation().state as { email?: string } | null)?.email
  const [left, setLeft] = useState(WAIT_SECONDS)
  const resend = useRequestReset()

  useEffect(() => {
    if (left <= 0) return
    const timer = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left])

  if (!email) return <Navigate to="/reset" replace />

  return (
    <Screen>
      <BrandBackBar to="/reset" label="Back" state={{ email }} />
      <div className="relative flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pt-9 pb-[max(28px,var(--safe-bottom))]">
        <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
          <IconMail size={30} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-28 font-bold tracking-[-0.02em]">Check your email</h1>
          <p className="text-15 leading-normal text-text-secondary">
            If <b className="text-text [overflow-wrap:anywhere]">{email}</b> has an OnTrack account, we sent it a reset
            link. The link works for 30 minutes.
          </p>
        </div>
        <a
          href="https://mail.google.com/"
          target="_blank"
          rel="noreferrer"
          className={`${buttonClasses('primary')} no-underline hover:text-on-brand`}
        >
          Open email app
        </a>
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-3.5">
          <span className="text-14 font-bold">Didn&apos;t get it?</span>
          <span className="flex gap-2.5 text-14 leading-[1.45] text-text-body">
            <IconClockSmall className="mt-0.5 flex-none text-text-secondary" />
            It can take a minute or two to arrive.
          </span>
          <span className="flex gap-2.5 text-14 leading-[1.45] text-text-body">
            <IconInbox className="mt-0.5 flex-none text-text-secondary" />
            Check spam or junk for mail from OnTrack.
          </span>
          <button
            type="button"
            disabled={left > 0 || resend.isPending}
            onClick={() => resend.mutate(email, { onSuccess: () => setLeft(WAIT_SECONDS) })}
            className="min-h-10 self-start text-14 font-semibold text-brand transition-colors hover:text-brand-strong active:text-brand-strong active:duration-0 disabled:text-text-secondary"
          >
            {resend.isPending
              ? 'Sending…'
              : left > 0
                ? `Resend link in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
                : 'Resend link'}
          </button>
          {resend.isSuccess && (
            <span role="status" className="text-13 font-semibold text-brand-strong">
              Link sent again. Use the newest email: it replaces the last one.
            </span>
          )}
          {resend.isError && (
            <span role="alert" className="text-13 font-semibold text-danger">
              That didn&apos;t go through. Wait a moment and try again.
            </span>
          )}
        </div>
        <div className="flex-1" />
        <Link
          to="/reset"
          className="flex min-h-tap flex-none items-center self-center text-14 font-semibold no-underline"
        >
          Use a different email
        </Link>
      </div>
    </Screen>
  )
}
