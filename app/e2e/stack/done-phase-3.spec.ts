import { createECDH, randomBytes } from 'node:crypto'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Phase 3's done test as one flow: a manager creates a ticket and the ops manager is sent
 * a push; the ops manager marks it In progress, posts an update the manager sees, and
 * closes it with a comment; the manager reopens it, and Ops sees Reopened on the dashboard.
 * Each step checks who was sent what in notification_deliveries, as send-push.spec does.
 * The stack's push sink answers 404, so a push logs as sent and then removes the device,
 * and each step that expects one first gives that person a device again. The buzz on a
 * real phone is tried by hand. Ops closes the ticket at the end, since it is Porter's.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const DANA = 'dana.ortiz@example.com'
const BERT = 'bert.velilla@example.com'
const CHRIS = 'chris.novak@example.com'

async function headers(request: APIRequestContext, email: string) {
  return { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, email)}` }
}

/** A phone with real keys, at a push service the stack sends to. */
async function addDevice(request: APIRequestContext, email: string) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/save_push_subscription`, {
    headers: await headers(request, email),
    data: {
      p_endpoint: `https://fcm.googleapis.com/fcm/send/done-${randomBytes(6).toString('hex')}`,
      p_p256dh: ecdh.getPublicKey().toString('base64url'),
      p_auth: randomBytes(16).toString('base64url'),
    },
  })
  expect(res.ok()).toBe(true)
}

/** How many of "kind:channel" this person was sent about this ticket. */
async function sent(request: APIRequestContext, email: string, id: string, what: string) {
  const res = await request.get(`${SUPABASE}/rest/v1/notification_deliveries?select=kind,channel&ticket_id=eq.${id}`, {
    headers: await headers(request, email),
  })
  const rows = (await res.json()) as { kind: string; channel: string }[]
  return rows.filter((r) => `${r.kind}:${r.channel}` === what).length
}

const eventually = (fn: () => Promise<number>, want: number) =>
  expect.poll(fn, { timeout: 20_000, intervals: [500] }).toBe(want)

test('a manager reports a problem, Ops works it to closed, and a reopen comes back to Ops', async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000)
  const title = `Ice machine not dropping ice ${testInfo.project.name} ${Date.now() % 100000}`
  const update = 'Part ordered, in on Thursday.'
  let id = ''

  // Dana at Porter, on their own phone.
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()

  try {
    // 1. Dana creates a ticket, and Bert's phone is sent a push.
    await addDevice(request, BERT)
    await signIn(dana, DANA)
    await dana.getByRole('link', { name: 'Create ticket', exact: true }).click()
    await dana.getByRole('radio', { name: 'Back of House' }).click()
    await dana.getByRole('link', { name: /^Refrigeration/ }).click()
    await dana.getByLabel('Title').fill(title)
    await dana.getByLabel('Description').fill('Bin is empty and the machine hums.')
    await dana.getByRole('button', { name: 'Submit ticket' }).click()
    await dana.getByRole('button', { name: 'Proceed without photo' }).click()
    await dana.getByRole('link', { name: new RegExp(title) }).click()
    await expect(dana.getByRole('heading', { name: title })).toBeVisible()
    id = new URL(dana.url()).pathname.split('/').pop()!

    await eventually(() => sent(request, BERT, id, 'new_ticket:push'), 1)
    await eventually(() => sent(request, BERT, id, 'new_ticket:email'), 1)
    await eventually(() => sent(request, CHRIS, id, 'new_ticket:email'), 1)
    expect(await sent(request, DANA, id, 'new_ticket:push')).toBe(0)

    // 2. Bert finds it on the dashboard and marks it In progress, which puts Bert on it.
    await addDevice(request, DANA)
    await signIn(page, BERT)
    await page.getByRole('link', { name: new RegExp(title) }).click()
    await page.getByRole('button', { name: /^Status/ }).click()
    await page.getByRole('menuitemradio', { name: 'In progress' }).click()
    await expect(page.getByRole('button', { name: /^Status/ })).toContainText('In progress')
    await expect(page.getByText('On it', { exact: true }).locator('..')).toContainText('You')
    await eventually(() => sent(request, DANA, id, 'status_change:push'), 1)

    // 3. Bert posts an update the restaurant can see, and Dana sees it.
    await addDevice(request, DANA)
    await page.getByRole('button', { name: 'Add update' }).click()
    await page.getByRole('textbox', { name: 'Write an update the restaurant can see' }).fill(update)
    await page.getByRole('button', { name: 'Post update' }).click()
    await expect(page.getByRole('log', { name: 'Ticket updates' }).getByText(update)).toBeVisible()
    await eventually(() => sent(request, DANA, id, 'update:push'), 1)

    await dana.reload()
    await expect(dana.getByRole('log', { name: 'Ticket updates' }).getByText(update)).toBeVisible()
    await testInfo.attach('manager-sees-update', { body: await dana.screenshot(), contentType: 'image/png' })

    // 4. Bert closes it with a comment and goes back to the dashboard.
    await addDevice(request, DANA)
    await page.getByRole('button', { name: /^Status/ }).click()
    await page.getByRole('menuitem', { name: 'Close ticket' }).click()
    const sheet = page.getByRole('dialog', { name: /^Close OT-\d+\?$/ })
    await sheet.getByLabel('Comment').fill('Replaced the water valve.')
    await sheet.getByRole('button', { name: 'Close ticket' }).click()
    await expect(page).toHaveURL(/\/ops$/)
    await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
    await eventually(() => sent(request, DANA, id, 'status_change:push'), 2)

    // 5. Dana sees it closed with Bert's comment, and reopens it with a reason.
    await addDevice(request, BERT)
    await dana.reload()
    await expect(dana.getByRole('heading', { name: 'Closed ticket' })).toBeVisible()
    await expect(dana.getByText('Replaced the water valve.')).toBeVisible()
    await dana.getByRole('button', { name: 'Reopen ticket' }).click()
    const ask = dana.getByRole('dialog', { name: 'Is the problem back?' })
    await ask.getByLabel("What's happening?").fill('Stopped again overnight.')
    await ask.getByRole('button', { name: 'Reopen ticket' }).click()
    await expect(dana.getByText(/Reopened and sent to Ops\./)).toBeVisible()
    await eventually(() => sent(request, BERT, id, 'reopened:push'), 1)
    await eventually(() => sent(request, CHRIS, id, 'reopened:email'), 1)

    // 6. Ops sees Reopened on the dashboard, with nobody on it.
    await page.reload()
    const card = page.getByRole('link', { name: new RegExp(title) })
    await expect(card).toContainText('Reopened')
    await testInfo.attach('ops-sees-reopened', { body: await page.screenshot(), contentType: 'image/png' })
    await card.click()
    await expect(page.getByText('On it', { exact: true }).locator('..')).toContainText('Nobody yet')
    await expect(page.getByRole('log', { name: 'Ticket updates' }).getByText('Stopped again overnight.')).toBeVisible()
  } finally {
    await context.close()
    if (id) {
      await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${id}`, {
        data: { status: 'closed', resolution: 'Closed by the done test' },
        headers: await headers(request, BERT),
      })
    }
  }
})
