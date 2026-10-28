import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { IconLock } from '../../components/icons'
import { BackBar, Screen } from '../../components/Screen'
import { ErrorBlock } from './ErrorBlock'

/**
 * Error · No access (403). The design's copy is for a ticket at another
 * restaurant; title and body are props so the same screen serves an area a
 * role may not enter and a session with no profile.
 */
type Props = {
  title: string
  body: ReactNode
  /** Where "Go to my tickets" leads. */
  backTo?: string
  backLabel?: string
  email?: string
  onSwitchAccount?: () => void | Promise<void>
  /** The crumb above (ticket id) when opened from a link. */
  crumb?: ReactNode
  hideAsk?: boolean
}

export function NoAccessScreen({
  title,
  body,
  backTo = '/',
  backLabel = 'Go to my tickets',
  email,
  onSwitchAccount,
  crumb,
  hideAsk = false,
}: Props) {
  const [asked, setAsked] = useState(false)
  return (
    <Screen>
      {crumb && (
        <BackBar to={backTo} label="Back">
          {crumb}
        </BackBar>
      )}
      <ErrorBlock code="Error 403" icon={<IconLock />} title={title} body={body}>
        <div className="mt-2.5 flex w-full max-w-[260px] flex-col gap-2.5">
          {!hideAsk && (
            <Button variant="primary" className="min-h-[48px] text-15" onClick={() => setAsked(true)} disabled={asked}>
              {asked ? 'Access requested' : 'Ask admin for access'}
            </Button>
          )}
          <ButtonLink to={backTo} variant="small">
            {backLabel}
          </ButtonLink>
        </div>
        {asked && (
          <p role="status" className="max-w-[290px] text-13 leading-normal text-brand-strong">
            We let your admin know. You'll get an email when they decide.
          </p>
        )}
        {email && (
          <p className="mt-3 max-w-[290px] text-13 leading-normal text-text-secondary">
            Signed in as {email} ·{' '}
            {onSwitchAccount ? (
              <button type="button" className="font-semibold text-brand" onClick={() => void onSwitchAccount()}>
                Switch account
              </button>
            ) : (
              <Link to="/sign-in" className="font-semibold">
                Switch account
              </Link>
            )}
          </p>
        )}
      </ErrorBlock>
    </Screen>
  )
}
