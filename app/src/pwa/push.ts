import { requireSupabase } from '../lib/supabase'

/**
 * Push on this device, apart from any screen. The browser holds the subscription and the
 * database holds a copy, so a push can reach it. An iPhone only offers push to an app
 * added to the Home Screen.
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

function within<T>(ms: number, work: Promise<T>) {
  return Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))])
}

export async function turnOnPush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false
  const registration = await within(10_000, navigator.serviceWorker.ready)
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: PUBLIC_KEY,
  })
  await save(subscription)
  return true
}

export async function turnOffPush() {
  const subscription = await deviceSubscription()
  if (!subscription) return
  const { error } = await requireSupabase().from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  if (error) throw error
  await subscription.unsubscribe()
}

/** Keeps the database's copy current, since a browser may change its subscription or the row may have been removed. */
export async function syncPush() {
  if (pushSupport() !== 'ready' || Notification.permission !== 'granted') return
  const subscription = await deviceSubscription()
  if (subscription) await save(subscription)
}

/** Signing out stops this device getting that person's notifications. It never holds up signing out. */
export async function forgetPushOnSignOut() {
  try {
    await within(3_000, turnOffPush())
  } catch {
    // Offline: the row goes when the push service reports the device gone, or the next sign-in takes it over.
  }
}
