import { createECDH, randomBytes } from 'node:crypto'
import { expect, test, type APIRequestContext, type Browser, type TestInfo } from '@playwright/test'
import { signIn, tokenFor, openRestaurants } from './helpers'

/**
 * My categories (OT-118). Theo is seeded with the IT title's starting view (Front and Back
 * of House off and hidden), so his lists leave them off and his pushes are IT's. Chris is
 * given the Ops manager title, which starts IT on Notify Off but shown: he sees a POS
 * ticket on the dashboard and isn't sent it. Each test puts back what it changed, since
 * both browsers run against one database.
 */

const THEO = 'theo.grant@example.com'
const CHRIS = 'chris.novak@example.com'
const CHRIS_ID = '22222222-2222-4222-8222-000000000004'
const DANA = 'dana.ortiz@example.com'
const ADMIN = 'admin@example.com'
const OPS_MANAGER_TITLE = 'eeeeeeee-eeee-4eee-8eee-000000000003'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

// Seeded: West Loop's Refrigeration ticket, and the bar POS ticket (IT).
const FRIDGE = 'Walk-in freezer door closer broken'
const POS = "Bar POS won't print kitchen tickets"

async function headers(request: APIRequestContext, email: string) {
  return { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, email)}` }
}

/** A device whose pushes are logged when sent (send-push.spec.ts explains the sink). */
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

/** Dana files a ticket at Porter in the area and category given, and its id back. */
async function newTicket(browser: Browser, testInfo: TestInfo, area: string, category: RegExp, word: string) {
  const title = `${word} ${testInfo.project.name} ${Date.now() % 100000}`
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, DANA)
  await dana.goto(`/tickets/new?area=${area}`)
  await dana.getByRole('link', { name: category }).click()
  await dana.getByLabel('Title').fill(title)
  await dana.getByRole('button', { name: 'Submit ticket' }).click()
  await dana.getByRole('button', { name: 'Proceed without photo' }).click()
  await dana.getByRole('link', { name: new RegExp(title) }).click()
  await expect(dana.getByRole('heading', { name: title })).toBeVisible()
  const id = new URL(dana.url()).pathname.split('/').pop()!
  await context.close()
  return { id, title }
}

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

test('hidden categories stay off the dashboard until Show all, and My categories changes them', async ({
  page,
}, testInfo) => {
  await signIn(page, THEO)
  await openRestaurants(page)
  const pos = page.getByRole('link', { name: new RegExp(POS) })
  const fridge = page.getByRole('link', { name: new RegExp(FRIDGE) })
  await expect(pos).toBeVisible()
  await expect(fridge).toHaveCount(0)
  await expect(page.getByText(/\d+ categories hidden/)).toBeVisible()
  await testInfo.attach('dashboard-hidden', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Show all' }).click()
  await openRestaurants(page)
  await expect(fridge).toBeVisible()
  await page.getByRole('button', { name: 'Hide them' }).click()
  await expect(fridge).toHaveCount(0)

  // A lasting link always opens it.
  await page.goto('/t/OT-1043')
  await expect(page.getByRole('heading', { name: FRIDGE })).toBeVisible()

  await page.goto('/profile')
  await page.getByRole('link', { name: /^My categories/ }).click()
  await expect(page.getByRole('heading', { name: 'My categories' })).toBeVisible()
  const back = page.getByRole('region', { name: 'Back of House' })
  const allBack = back.getByRole('button', { name: /^All/ })
  await expect(allBack).toHaveAccessibleName(/Notify off · Hidden/)
  // Its categories are folded under All until it is opened (OT-120).
  await expect(back.getByRole('button', { name: /^Refrigeration/ })).toHaveCount(0)
  await allBack.click()
  await expect(allBack).toHaveAttribute('aria-expanded', 'true')
  await expect(back.getByRole('button', { name: /^More settings for all of Back of House/ })).toBeVisible()
  await expect(back.getByRole('button', { name: /^Refrigeration.*Same as Back of House/ })).toBeVisible()
  await testInfo.attach('my-categories', { body: await page.screenshot(), contentType: 'image/png' })

  // Refrigeration shown on its own, while Back of House stays hidden.
  await back.getByRole('button', { name: /^Refrigeration/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Refrigeration' })
  await sheet.getByRole('radio', { name: 'Shown' }).click()
  await testInfo.attach('category-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(back.getByRole('button', { name: /^Refrigeration.*Notify off · Shown/ })).toBeVisible()
  // Folded, All says a category is set on its own.
  await allBack.click()
  await expect(allBack).toHaveAccessibleName(/Notify off · Hidden · 1 set on its own/)

  await page.goto('/ops')
  await openRestaurants(page)
  await expect(fridge).toBeVisible()
  await expect(page.getByRole('link', { name: /Dish machine not reaching rinse temp/ })).toHaveCount(0)

  // Back to following the area.
  await page.goto('/profile/categories')
  await allBack.click()
  await back.getByRole('button', { name: /^Refrigeration/ }).click()
  await page
    .getByRole('dialog', { name: 'Refrigeration' })
    .getByRole('button', { name: 'Same as Back of House' })
    .click()
  await expect(back.getByRole('button', { name: /^Refrigeration.*Same as Back of House/ })).toBeVisible()

  // The switch on a row turns it all on or off at once (OT-119), and stays after a reload.
  const backSwitch = back.getByRole('switch', { name: 'All of Back of House' })
  await expect(backSwitch).not.toBeChecked()
  await backSwitch.click()
  await expect(allBack).toHaveAccessibleName(/Notify all · Shown/)
  await page.reload()
  await expect(backSwitch).toBeChecked()
  await testInfo.attach('switches', { body: await page.screenshot(), contentType: 'image/png' })
  await page.goto('/ops')
  await openRestaurants(page)
  await expect(fridge).toBeVisible()
  await page.goto('/profile/categories')
  await backSwitch.click()
  await expect(allBack).toHaveAccessibleName(/Notify off · Hidden/)
  await page.reload()
  await expect(backSwitch).not.toBeChecked()
})

test('IT hears of a POS ticket and not a Back of House one; the Ops manager title sees it without a push', async ({
  browser,
  page,
  request,
}, testInfo) => {
  const admin = await headers(request, ADMIN)
  const given = await request.post(`${SUPABASE}/rest/v1/rpc/set_person_access`, {
    headers: admin,
    data: { p_user: CHRIS_ID, p_role: 'ops', p_restaurants: [], p_job_title: OPS_MANAGER_TITLE },
  })
  expect(given.ok()).toBe(true)

  try {
    await addDevice(request, THEO)
    await addDevice(request, CHRIS)

    const pos = await newTicket(browser, testInfo, 'it', /^POS & network/, 'Till')
    await eventually(() => sent(request, THEO, pos.id), ['new_ticket:email', 'new_ticket:push'])
    const fridge = await newTicket(browser, testInfo, 'boh', /^Refrigeration/, 'Cooler')
    // Bert still hears of it, so the fridge ticket's notifications have gone out.
    await expect
      .poll(() => sent(request, 'bert.velilla@example.com', fridge.id), { timeout: 20_000, intervals: [500] })
      .toContain('new_ticket:email')
    expect(await sent(request, THEO, fridge.id)).toEqual([])
    expect(await sent(request, CHRIS, pos.id)).toEqual([])
    expect(await sent(request, CHRIS, fridge.id)).toEqual(['new_ticket:email', 'new_ticket:push'])

    await signIn(page, CHRIS)
    await openRestaurants(page)
    await expect(page.getByRole('link', { name: new RegExp(pos.title) })).toBeVisible()
    await expect(page.getByText(/categories hidden/)).toHaveCount(0)
  } finally {
    // Taking the title off leaves his settings, so he puts IT back himself.
    await request.post(`${SUPABASE}/rest/v1/rpc/set_person_access`, {
      headers: admin,
      data: { p_user: CHRIS_ID, p_role: 'ops', p_restaurants: [], p_job_title: null },
    })
    await request.delete(`${SUPABASE}/rest/v1/area_prefs?user_id=eq.${CHRIS_ID}`, {
      headers: await headers(request, CHRIS),
    })
  }
})
