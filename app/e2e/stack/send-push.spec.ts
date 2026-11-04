import { createECDH, randomBytes } from 'node:crypto'
import { expect, test, type APIRequestContext, type Browser, type TestInfo } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Who is sent what, for real: the database calls send-push, which encrypts and posts each
 * push to the stack's sink and sends each email to Mailpit, and logs what it did. Each person
 * reads their own log. The sink answers 404, so a push logs as gone and removes the device,
 * which still proves it was sent to the right person. Each test makes its own ticket.
 */

const BERT = 'bert.velilla@example.com'
const CHRIS = 'chris.novak@example.com'
const DANA = 'dana.ortiz@example.com'
const ARI = 'ari.kim@example.com'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

async function headers(request: APIRequestContext, email: string) {
  return { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, email)}` }
}

/** A real key pair for a device that will read as gone once a push reaches the sink. */
async function addDevice(request: APIRequestContext, email: string) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/save_push_subscription`, {
    headers: await headers(request, email),
    data: {
      p_endpoint: `https://fcm.googleapis.com/fcm/send/test-${randomBytes(6).toString('hex')}`,
      p_p256dh: ecdh.getPublicKey().toString('base64url'),
      p_auth: randomBytes(16).toString('base64url'),
    },
  })
  expect(res.ok()).toBe(true)
}

async function newTicket(browser: Browser, testInfo: TestInfo, word: string) {
  const title = `${word} ${testInfo.project.name} ${Date.now() % 100000}`
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, DANA)
  await dana.goto('/tickets/new?area=boh')
  await dana.getByRole('link', { name: /^Refrigeration/ }).click()
  await dana.getByLabel('Title').fill(title)
  await dana.getByRole('button', { name: 'Submit ticket' }).click()
  await dana.getByRole('link', { name: new RegExp(title) }).click()
  await expect(dana.getByRole('heading', { name: title })).toBeVisible()
  const id = new URL(dana.url()).pathname.split('/').pop()!
  await context.close()
  return { id, title }
}

/** "kind:channel" for what this person was sent about this ticket. */
async function sent(request: APIRequestContext, email: string, id: string) {
  const res = await request.get(
    `${SUPABASE}/rest/v1/notification_deliveries?select=kind,channel&ticket_id=eq.${id}&order=created_at`,
    { headers: await headers(request, email) },
  )
  const rows = (await res.json()) as { kind: string; channel: string }[]
  return rows.map((r) => `${r.kind}:${r.channel}`).sort()
}

const eventually = (fn: () => Promise<string[]>, want: string[]) =>
  expect.poll(fn, { timeout: 20_000, intervals: [500] }).toEqual(want)

test('a new ticket reaches Ops by push and email, with a link, and nobody else', async ({
  browser,
  request,
}, testInfo) => {
  await addDevice(request, BERT)
  const { id, title } = await newTicket(browser, testInfo, 'New')

  await eventually(() => sent(request, BERT, id), ['new_ticket:email', 'new_ticket:push'])
  await eventually(() => sent(request, CHRIS, id), ['new_ticket:email'])
  expect(await sent(request, DANA, id)).toEqual([])
  expect(await sent(request, ARI, id)).toEqual([])

  // The email carries enough to summarize, and the lasting link.
  const search = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${BERT} "${title}"`)}`)
  const { messages } = (await search.json()) as { messages: { ID: string; Subject: string }[] }
  expect(messages[0]!.Subject).toMatch(/^\[OT-\d+\] New ticket at Porter$/)
  const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)
  const { Text } = (await message.json()) as { Text: string }
  expect(Text).toContain(title)
  expect(Text).toContain('Dana Ortiz')
  expect(Text).toContain(`/t/${messages[0]!.Subject.match(/OT-\d+/)![0]}`)
})

test('work on a ticket reaches the restaurant, and Ops’s own by email only', async ({ browser, request }, testInfo) => {
  const { id } = await newTicket(browser, testInfo, 'Work')
  await addDevice(request, DANA)
  const bert = await headers(request, BERT)

  const started = await request.post(`${SUPABASE}/rest/v1/rpc/set_ticket_status`, {
    headers: bert,
    data: { p_id: id, p_status: 'in_progress' },
  })
  expect(started.ok()).toBe(true)
  await eventually(() => sent(request, DANA, id), ['status_change:email', 'status_change:push'])
  await eventually(() => sent(request, BERT, id), ['new_ticket:email', 'status_change:email'])
  // Another Ops manager hears that it was picked up, by email only.
  await eventually(() => sent(request, CHRIS, id), ['new_ticket:email', 'status_change:email'])

  // An internal note reaches nobody at the restaurant, and the note's author by email.
  const note = await request.post(`${SUPABASE}/rest/v1/rpc/post_ticket_update`, {
    headers: bert,
    data: { p_ticket_id: id, p_body: 'Quote looks high', p_internal: true },
  })
  expect(note.ok()).toBe(true)
  await eventually(() => sent(request, BERT, id), ['new_ticket:email', 'status_change:email', 'update:email'])
  expect((await sent(request, DANA, id)).filter((s) => s.startsWith('update'))).toEqual([])
  const leaked = await request.get(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${DANA} "Quote looks high"`)}`,
  )
  expect(((await leaked.json()) as { messages_count: number }).messages_count).toBe(0)
})

test('turning off a kind and email stop what they cover', async ({ browser, request }, testInfo) => {
  const chris = await headers(request, CHRIS)
  const set = (kind: string, enabled: boolean) =>
    request.post(`${SUPABASE}/rest/v1/notification_prefs?on_conflict=user_id,kind`, {
      headers: { ...chris, Prefer: 'resolution=merge-duplicates' },
      data: { user_id: '22222222-2222-4222-8222-000000000004', kind, enabled },
    })
  expect((await set('email', false)).ok()).toBe(true)
  try {
    const { id } = await newTicket(browser, testInfo, 'Quiet')
    await eventually(() => sent(request, BERT, id), ['new_ticket:email'])
    expect(await sent(request, CHRIS, id)).toEqual([])
  } finally {
    await set('email', true)
  }
})

test('send-push refuses anyone without the secret', async ({ request }) => {
  const url = `${SUPABASE}/functions/v1/send-push`
  expect((await request.post(url, { data: {} })).status()).toBe(401)
  const signedIn = await request.post(url, { headers: await headers(request, BERT), data: {} })
  expect(signedIn.status()).toBe(401)
})
