import { requireSupabase } from '../lib/supabase'

/**
 * Push on this device, apart from any screen. The browser holds the subscription and the
 * database holds a copy, so a push can reach it. An iPhone only offers push to an app
 * added to the Home Screen. Signing out turns push off, so a shared phone stops getting
 * the last person's tickets, but the phone remembers per person that they had it on and
 * turns it back on when they sign back in. Only turning it off yourself forgets that.
 */

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushSupport = 'ready' | 'not-configured' | 'install-first' | 'unsupported' | 'blocked'

export function pushSupport(): PushSupport {
  if (!PUBLIC_KEY) return 'not-configured'
  const browserCan = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!browserCan) {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    return /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone ? 'install-first' : 'unsupported'
  }
  return Notification.permission === 'denied' ? 'blocked' : 'ready'
}

/** This device's subscription, or none. Doesn't wait for a worker that may never come. */
export async function deviceSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

async function save(subscription: PushSubscription) {
  const { keys } = subscription.toJSON()
  const { error } = await requireSupabase().rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: keys?.p256dh ?? '',
    p_auth: keys?.auth ?? '',
  })
  if (error) throw error
}

const wantKey = (userId: string) => `ontrack.push-on.${userId}`

function wantsPush(userId: string) {
  try {
    return localStorage.getItem(wantKey(userId)) === '1'
  } catch {
    return false
  }
}

function rememberPush(userId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(wantKey(userId), '1')
    else localStorage.removeItem(wantKey(userId))
  } catch {
    // Private windows: they turn it on again themselves after signing back in.
  }
}

function within<T>(ms: number, work: Promise<T>) {
  return Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))])
}

async function subscribe() {
  const registration = await within(10_000, navigator.serviceWorker.ready)
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: PUBLIC_KEY,
  })
  await save(subscription)
}

export async function turnOnPush(userId: string) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false
  await subscribe()
  rememberPush(userId, true)
  return true
}

/** Turned off on Profile: it stays off, even after signing back in. */
export async function turnOffPush(userId: string) {
  await unsubscribe()
  rememberPush(userId, false)
}

async function unsubscribe() {
  const subscription = await deviceSubscription()
  if (!subscription) return
  const { error } = await requireSupabase().from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  if (error) throw error
  await subscription.unsubscribe()
}

/**
 * Keeps the database's copy current, since a browser may change its subscription or the
 * row may have been removed, and turns push back on for someone who had it on here
 * before signing out. Permission was given already then, so nothing asks again.
 */
export async function syncPush(userId: string) {
  if (pushSupport() !== 'ready' || Notification.permission !== 'granted') return
  const subscription = await deviceSubscription()
  if (subscription) {
    await save(subscription)
    rememberPush(userId, true)
  } else if (wantsPush(userId)) {
    await subscribe()
  }
}

/** Signing out stops this device getting that person's notifications. It never holds up signing out. */
export async function forgetPushOnSignOut() {
  try {
    await within(3_000, unsubscribe())
  } catch {
    // Offline: the row goes when the push service reports the device gone, or the next sign-in takes it over.
  }
}
