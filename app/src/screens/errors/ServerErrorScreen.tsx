import { useState } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button } from '../../components/Button'
import { IconFlag, IconServer, Logo } from '../../components/icons'
import { Screen } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { Textarea } from '../../components/Field'
import { TabBar } from '../../components/TabBar'
import { ROLE_TABS } from '../../app/roles'
import { useOptionalAuth } from '../../auth/context'
import { ErrorBlock } from './ErrorBlock'
import { NotFoundScreen } from './NotFoundScreen'

/**
 * Error · Something went wrong (500). Used as the router's error boundary.
 * Shows a short reference the person can copy or send to support; the
 * reference and the error are logged to the console until the send-email
 * function lands in Phase 1.
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
  const [sent, setSent] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const [{ ref, time }] = useState(() => {
    const at = new Date()
    const message = given instanceof Error ? `${given.name}:${given.message}` : String(given ?? 'unknown')
    return {
      ref: makeRef(`${message}|${at.toISOString().slice(0, 16)}`),
      time: at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }
  })

  if (given) console.error(`[OnTrack] REF ${ref}`, given)

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

  const send = () => {
    // Phase 1 wires this to the send-email function with the reference, the
    // screen and device info attached.
    console.info(`[OnTrack] report REF ${ref}: ${note}`)
    setReportOpen(false)
    setSent(`Sent to support. Case #${(parseInt(ref.replace('-', ''), 16) % 9000) + 1000}. We'll email you.`)
  }

  return (
    <Screen>
      <div className="flex items-center px-screen pt-safe">
        <span className="mt-5 flex items-center gap-2">
          <Logo />
          <span className="font-display text-[17px] font-bold">OnTrack</span>
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
            If it keeps happening, report it. This reference is attached for you.
          </span>
          <div className="flex items-center gap-2 rounded-control border border-border bg-surface py-1 pl-3 pr-1">
            <span className="font-mono text-13 text-text-body">
              REF {ref} · {time}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-live="polite"
              className="min-h-9 rounded-lg bg-surface-muted px-2.5 text-13 font-semibold text-text"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <Button variant="ghost" icon={<IconFlag />} onClick={() => setReportOpen(true)}>
            Report this problem
          </Button>
          {sent && (
            <p role="status" className="text-13 font-semibold text-brand-strong">
              {sent}
            </p>
          )}
        </div>
      </ErrorBlock>
      {user && <TabBar label={ROLE_TABS[user.role].label} items={ROLE_TABS[user.role].items} />}

      <Sheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Report a problem"
        description={`Goes to OnTrack support. Error 500, reference ${ref}, this screen and your device info are attached.`}
      >
        <Textarea
          label="What happened?"
          rows={3}
          placeholder="What were you trying to do, and what went wrong?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <label className="flex min-h-tap cursor-pointer items-center gap-2.5 text-14 text-text-body">
          <input type="checkbox" defaultChecked className="h-5 w-5 accent-brand" />
          Include a screenshot
        </label>
        <Button variant="primary" onClick={send}>
          Send to support
        </Button>
        <Button variant="secondary" onClick={() => setReportOpen(false)}>
          Cancel
        </Button>
      </Sheet>
    </Screen>
  )
}

/** Router errorElement: 404 responses get the not-found screen, everything else the 500. */
export function RouteErrorScreen() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundScreen />
  return <ServerErrorScreen error={error} />
}
