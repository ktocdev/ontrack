import { useSyncExternalStore } from 'react'

/** Chrome and Edge fire this before showing their own install banner. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'installed' | 'available' | 'ios-manual' | 'unavailable'

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

/**
 * Chrome offers the install once, early in the page's life, often before any screen that
 * would use it has mounted, so the offer is kept here from the start (listenForInstall, in
 * main.tsx) and screens read it through useInstallPrompt.
 */
let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())

export function listenForInstall() {
  installed = isStandalone()
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    changed()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    changed()
  })
}

function current(): InstallState {
  if (installed || isStandalone()) return 'installed'
  if (deferred) return 'available'
  return isIosSafari() ? 'ios-manual' : 'unavailable'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Chrome's own install sheet, once per offer; the browser decides whether to offer again. */
async function promptInstall() {
  const offer = deferred
  if (!offer) return 'unavailable' as const
  deferred = null
  changed()
  await offer.prompt()
  return (await offer.userChoice).outcome
}

/**
 * Whether the app can be installed from this browser. iPhone has no install event: Safari
 * users add to the Home Screen by hand, so the state is 'ios-manual' there and the screen
 * shows the two steps.
 */
export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, current, () => 'unavailable' as const)
  return { state, promptInstall }
}
