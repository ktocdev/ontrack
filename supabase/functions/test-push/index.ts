import { getCaller, json, refuse, serve } from '../_shared/http.ts'
import { pushServer, sendPush } from '../_shared/push.ts'

/**
 * Profile · Send a test notification, to the device asking. It reads the device with the
 * caller's own token, so RLS keeps this to their own devices, and anyone owing their second
 * step has none. A device the push service no longer knows is removed.
 */

serve(async (req, body) => {
  const caller = await getCaller(req)
  if (!caller) return refuse('not_signed_in', 401)
  if (typeof body.endpoint !== 'string') return refuse('bad_request', 422)

  const server = await pushServer()
  if (!server) return refuse('push_not_configured', 503)

  const { data: device, error } = await caller.db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('endpoint', body.endpoint)
    .maybeSingle()
  if (error) throw error
  if (!device) return refuse('not_subscribed', 404)

  const result = await sendPush(server, device, {
    title: 'OnTrack',
    body: 'Notifications are working on this device.',
    url: '/profile',
    tag: 'test',
  })
  if (result === 'gone') {
    const { error: removeError } = await caller.db.from('push_subscriptions').delete().eq('endpoint', device.endpoint)
    if (removeError) throw removeError
  }
  return json({ ok: true, result })
})
