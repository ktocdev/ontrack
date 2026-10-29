import { useEffect, useState } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button } from '../../components/Button'
import { IconFlag, IconServer, Logo } from '../../components/icons'
import { Screen } from '../../components/Screen'
import { TabBar } from '../../components/TabBar'
import { ROLE_TABS } from '../../app/roles'
import { useOptionalAuth } from '../../auth/context'
import { ReportSheet } from '../profile/ReportSheet'
import { ErrorBlock } from './ErrorBlock'
import { NotFoundScreen } from './NotFoundScreen'

/**
 * Error · Something went wrong (500). Used as the router's error boundary.
 * Shows a short reference the person can copy, or attach to a report when
 * signed in (support_reports only takes reports from a signed-in person).
 */

function makeRef(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, '0')
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

export function ServerErrorScreen({ error: given, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const auth = useOptionalAuth()
  const user = auth?.status === 'signed-in' ? auth.user : null
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const [{ ref, time }] = useState(() => {
    const at = new Date()
    const message = given instanceof Error ? `${given.name}:${given.message}` : String(given ?? 'unknown')
    return {
      ref: makeRef(`${message}|${at.toISOString().slice(0, 16)}`),
      time: at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }
  })

  useEffect(() => {
    if (given) console.error(`[OnTrack] REF ${ref}`, given)
  }, [given, ref])

  const retry = () => {
    setBusy(true)
    window.setTimeout(() => {
      if (onRetry) onRetry()
      else window.location.reload()
    }, 400)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`REF ${ref} · ${time}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the text is still visible to copy by hand.
    }
  }

  return (
    <Screen>
      <div className="flex items-center px-screen pt-safe">
        <span className="mt-5 flex items-center gap-2">
          <Logo />
          <span className="font-display text-17 font-bold">OnTrack</span>
        </span>
      </div>
      <ErrorBlock
        role="alert"
        code="Error 500"
        tone="danger"
        icon={<IconServer />}
        title="Something went wrong on our end"
        body="We couldn't load this screen. Your tickets and data are safe. Try again in a moment."
      >
        <div className="mt-2.5 w-full max-w-[260px]">
          <Button variant="primary" className="min-h-[48px] text-15" loading={busy} onClick={retry}>
            {busy ? 'Trying again…' : 'Try again'}
          </Button>
        </div>
        <div className="mt-3.5 flex flex-col items-center gap-1">
          <span className="text-13 text-text-secondary">
            {user
              ? 'If it keeps happening, report it. This reference is attached for you.'
              : 'If it keeps happening, send this reference to your admin.'}
          </span>
          <div className="flex items-center gap-2 rounded-control border border-border bg-surface py-1 pl-3 pr-1">
            <span className="font-mono text-13 text-text-body">
              REF {ref} · {time}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-live="polite"
              className="min-h-9 rounded-control bg-surface-muted px-2.5 text-13 font-semibold text-text"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {user && (
            <Button variant="ghost" icon={<IconFlag />} onClick={() => setReportOpen(true)}>
              Report this problem
            </Button>
          )}
        </div>
      </ErrorBlock>
      {user && <TabBar label={ROLE_TABS[user.role].label} items={ROLE_TABS[user.role].items} />}

      {user && <ReportSheet open={reportOpen} onOpenChange={setReportOpen} context={`Error 500 · REF ${ref}`} />}
    </Screen>
  )
}

/** Router errorElement: 404 responses get the not-found screen, everything else the 500. */
export function RouteErrorScreen() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundScreen />
  return <ServerErrorScreen error={error} />
}
