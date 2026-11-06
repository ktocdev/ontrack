import type { ReactNode } from 'react'
import type { InstallState } from '../pwa/useInstallPrompt'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { IconDownload, IconPlusSquare, IconShareIos } from './icons'

/**
 * Install the app (OT-72; no board draws it). Where Chrome can install, Install opens its
 * own sheet. Safari on an iPhone has no such call, so the sheet shows the two steps,
 * Share and then Add to Home Screen, and says why it matters there: push only reaches an
 * installed app. Shown once after signing in on a phone, and from Profile until installed.
 */
export function InstallSheet({
  open,
  onOpenChange,
  state,
  onInstall,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: InstallState
  onInstall: () => void
}) {
  const ios = state === 'ios-manual'
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Install OnTrack"
      description={
        ios
          ? 'Add OnTrack to your Home Screen to open it like any app. On an iPhone, notifications only work from there.'
          : 'Add OnTrack to your Home Screen to open it like any app, full screen and one tap away.'
      }
    >
      {ios ? (
        <>
          <ol aria-label="How to install" className="flex flex-col gap-2.5">
            <Step n={1} icon={<IconShareIos size={22} />}>
              Tap <b className="font-semibold text-text">Share</b> in Safari’s toolbar
            </Step>
            <Step n={2} icon={<IconPlusSquare size={22} />}>
              Scroll down and tap <b className="font-semibold text-text">Add to Home Screen</b>, then Add
            </Step>
          </ol>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </>
      ) : (
        <>
          <Button icon={<IconDownload size={20} />} onClick={onInstall}>
            Install
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </>
      )}
    </Sheet>
  )
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-2.5">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-brand-tint text-13 font-bold text-brand"
      >
        {n}
      </span>
      <span className="min-w-0 flex-1 text-14 leading-snug text-text-body">{children}</span>
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-control bg-surface-sunken text-brand">
        {icon}
      </span>
    </li>
  )
}
