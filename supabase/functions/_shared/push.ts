import * as webpush from 'jsr:@negrel/webpush@0.5.0'

/**
 * Web Push, encrypted on the way out. VAPID_KEYS is the JSON that app/scripts/vapid.mjs
 * prints. Endpoints come from push_subscriptions, whose constraint only takes the browsers'
 * own push services. PUSH_SINK_URL is set only in config.toml for the local stack, so no
 * flow test depends on a real push service.
 */

export type PushDevice = { endpoint: string; p256dh: string; auth: string }
export type PushNote = {
  title: string
  body: string
  /** A path in the app, opened when the notification is tapped. */
  url: string
  /** A newer notification with the same tag replaces this one. */
  tag?: string
}

export async function pushServer() {
  const keys = Deno.env.get('VAPID_KEYS')
  if (!keys) return null
  const support = Deno.env.get('SUPPORT_EMAIL')?.trim()
  return await webpush.ApplicationServer.new({
    // Push services contact this address about a misbehaving sender.
    contactInformation: support ? `mailto:${support}` : Deno.env.get('APP_URL')!,
    vapidKeys: await webpush.importVapidKeys(JSON.parse(keys), { extractable: false }),
  })
}

/** 'gone' means the device has unsubscribed or expired, so its row should be removed. */
export async function sendPush(
  server: webpush.ApplicationServer,
  device: PushDevice,
  note: PushNote,
): Promise<'sent' | 'gone'> {
  const subscriber = server.subscribe({
    endpoint: Deno.env.get('PUSH_SINK_URL') ?? device.endpoint,
    keys: { p256dh: device.p256dh, auth: device.auth },
  })
  try {
    // A day: a ticket's news is stale after that, and the app shows it anyway.
    await subscriber.pushTextMessage(JSON.stringify(note), { ttl: 86_400, urgency: webpush.Urgency.High })
    return 'sent'
  } catch (e) {
    if (e instanceof webpush.PushMessageError && [404, 410].includes(e.response.status)) return 'gone'
    throw e
  }
}
