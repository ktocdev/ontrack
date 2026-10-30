import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Screen } from '../../components/Screen'
import { BrandMark, IconTimer } from '../../components/icons'
import { ErrorBlock } from '../errors/ErrorBlock'

/**
 * Error · Link expired (design/screens/Error-Expired-Link), invite version; the
 * reset version arrives with OT-11. The board says invites last 7 days; they last
 * 72 hours. The same screen answers a link that was used or revoked, without the
 * request button, since a new invite is not what either of those needs.
 */
export function LinkExpiredScreen({
  title = 'This invite has expired',
  body = 'Invites last 72 hours. Ask your IT admin to send you a new one.',
  onRequest,
  requesting = false,
  requested = false,
  failed = false,
}: {
  title?: string
  body?: string
  /** Leave out when there is nothing to ask for. */
  onRequest?: () => void
  requesting?: boolean
  requested?: boolean
  failed?: boolean
}) {
  return (
    <Screen>
      <div className="px-6 pt-[calc(28px+var(--safe-top))]">
        <BrandMark />
      </div>
      <ErrorBlock tone="waiting" icon={<IconTimer size={30} />} title={title} body={body}>
        <div className="mt-2.5 flex w-full max-w-[260px] flex-col gap-2.5">
          {onRequest &&
            (requested ? (
              <Button variant="done" className="w-full" disabled>
                Request sent
              </Button>
            ) : (
              <Button variant="medium" className="w-full" loading={requesting} onClick={onRequest}>
                Ask admin for a new invite
              </Button>
            ))}
          <Link to="/sign-in" className="flex min-h-tap items-center justify-center text-14 font-semibold no-underline">
            Back to sign in
          </Link>
        </div>
        {requested && (
          <p role="status" className="max-w-[290px] text-13 leading-normal text-brand-strong">
            We let your admin know. Your new invite will come by email.
          </p>
        )}
        {failed && (
          <p role="alert" className="max-w-[290px] text-13 font-semibold leading-normal text-danger">
            That didn&apos;t go through. Check your connection and try again.
          </p>
        )}
      </ErrorBlock>
    </Screen>
  )
}
