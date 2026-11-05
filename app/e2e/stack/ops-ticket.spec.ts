import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { bigPhoto, signIn, tokenFor } from './helpers'

/**
 * Ops · Ticket against the seed. Status changes happen on OT-1047, an open ticket at
 * Porter nobody has, which is put back around each test, since other flows read it as open.
 */

// CI runs in UTC, and this reads clock times from the seed.
test.use({ timezoneId: 'America/Chicago' })

const T1047 = '66666666-6666-4666-8666-000000001047'
const T1042 = '66666666-6666-4666-8666-000000001042'
const BERT = 'bert.velilla@example.com'
const CHRIS = 'chris.novak@example.com'

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

async function putBack(request: APIRequestContext) {
  const token = await tokenFor(request, BERT)
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/set_ticket_status`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    data: { p_id: T1047, p_status: 'open' },
  })
  expect(res.ok()).toBe(true)
}

test.beforeEach(({ request }) => putBack(request))
test.afterEach(({ request }) => putBack(request))

const onIt = (page: Page) => page.getByText('On it', { exact: true }).locator('..')
const statusButton = (page: Page) => page.getByRole('button', { name: /^Status/ })

async function pick(page: Page, name: string) {
  await statusButton(page).click()
  await page.getByRole('menuitemradio', { name }).click()
}

test('the ticket shows what the board does, without what later phases build', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1042}`)
  await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp' })).toBeVisible()
  await expect(page.getByText('OT-1042')).toBeVisible()
  await expect(page.getByText('URGENT')).toBeVisible()
  await expect(page.getByText('Federale’s Logan Square')).toBeVisible()
  await expect(page.getByText('Reporter', { exact: true }).locator('..')).toContainText('Maya Reyes')
  await expect(page.getByText(/^From \w+ walkthrough$/)).toBeVisible()
  await expect(page.getByText('Oct 19, 2026 - 9:12 AM')).toBeVisible()
  await expect(page.getByText('Reading 46°F')).toBeVisible()
  await expect(page.getByText('Walk-in Cooler 1')).toBeVisible()
  await expect(statusButton(page)).toContainText('In progress')

  // Nobody assigns, and Log service waits for Phase 5.
  await expect(page.getByRole('button', { name: /^Assigned/ })).toHaveCount(0)
  await expect(page.getByText('Log service')).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('ticket', { body: await page.screenshot(), contentType: 'image/png' })

  await statusButton(page).click()
  await page.waitForTimeout(200)
  await testInfo.attach('status-menu', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Escape')

  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page).toHaveURL(/\/ops$/)
})

test('In progress puts you on it, and back to Open takes you off, on the dashboard too', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1047}`)
  await expect(onIt(page)).toContainText('Nobody yet')
  await expect(page.getByText('Nobody has this yet')).toHaveCount(0)

  await pick(page, 'In progress')
  await expect(statusButton(page)).toContainText('In progress')
  await expect(onIt(page)).toContainText('You')

  await pick(page, 'Open')
  await expect(onIt(page)).toContainText('Nobody yet')
  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page.getByRole('link', { name: /OT-1047/ })).toContainText('Open')
})

test('Scheduled asks for a date, and Cancel changes nothing', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1047}`)
  await pick(page, 'Scheduled')
  const sheet = page.getByRole('dialog', { name: 'When is it scheduled?' })
  await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled()
  await page.waitForTimeout(300)
  await testInfo.attach('schedule', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(statusButton(page)).toContainText('Open')

  await pick(page, 'Scheduled')
  await sheet.getByLabel('Date').fill('2030-03-12')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(statusButton(page)).toContainText('Scheduled Mar 12')
})

test('someone else’s ticket can be taken over', async ({ page, browser }, testInfo) => {
  await signIn(page, CHRIS)
  await page.goto(`/ops/tickets/${T1047}`)
  await pick(page, 'In progress')
  await expect(onIt(page)).toContainText('You')

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const other = await context.newPage()
  await signIn(other, BERT)
  await other.goto(`/ops/tickets/${T1047}`)
  await expect(onIt(other)).toContainText('Chris Novak')
  await statusButton(other).click()
  await other.getByRole('menuitem', { name: 'Take this over' }).click()
  await expect(onIt(other)).toContainText('You')
  await context.close()
})

test('a failed change says so and leaves the status', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1047}`)
  await page.route('**/rest/v1/rpc/set_ticket_status', (route) =>
    route.fulfill({ status: 500, json: { message: 'nope' } }),
  )
  await pick(page, 'In progress')
  await expect(page.getByRole('status').filter({ hasText: 'Couldn’t change that.' })).toBeVisible()
  await expect(statusButton(page)).toContainText('Open')
})

test('a closed ticket has no controls, and a ticket that isn’t there says so', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto('/ops/tickets/66666666-6666-4666-8666-000000001028')
  await expect(page.getByRole('heading', { name: 'Booth 12 upholstery torn' })).toBeVisible()
  await expect(statusButton(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Post update' })).toHaveCount(0)
  await page.goto('/ops/tickets/not-a-ticket')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})

test('the thread shows updates and internal notes, tagged', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1042}`)
  const log = page.getByRole('log', { name: 'Ticket updates' })
  await expect(page.getByText(/^Updates · \d+$/)).toBeVisible()
  await expect(log.getByText(/^Opened by Maya Reyes · all Ops managers notified · /)).toBeVisible()
  await expect(log.getByText(/^You took this · status In progress · /)).toBeVisible()
  await expect(log.getByText('Coldline quoted $185')).toBeVisible()
  await expect(log.getByText('Ops only')).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('thread', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

test('the message box stays hidden until asked for, and hiding it keeps the draft', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1047}`)
  const box = page.getByRole('textbox', { name: 'Write an update the restaurant can see' })
  await expect(box).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Visible to restaurant' })).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('hidden', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Add update' }).click()
  await expect(box).toBeFocused()
  await expect(page.getByRole('button', { name: 'Add update' })).toHaveCount(0)
  await box.fill('Half a thought')
  await page.waitForTimeout(300)
  await testInfo.attach('shown', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Hide message box' }).click()
  await expect(box).toHaveCount(0)
  await page.getByRole('button', { name: 'Add update' }).click()
  await expect(box).toHaveValue('Half a thought')
})

test('an update reaches the restaurant, and an internal note does not', async ({ page, browser }, testInfo) => {
  const stamp = `${testInfo.project.name} ${Date.now() % 100000}`
  const visible = `Tech booked for two ${stamp}`
  const note = `Quote looks high ${stamp}`
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1047}`)
  const log = page.getByRole('log', { name: 'Ticket updates' })

  await page.getByRole('button', { name: 'Add update' }).click()
  await page.getByRole('textbox', { name: 'Write an update the restaurant can see' }).fill(visible)
  await page.getByRole('button', { name: 'Post update' }).click()
  await expect(log.getByText(visible)).toBeVisible()

  // Posting closes the box again.
  await page.getByRole('button', { name: 'Add update' }).click()
  await page.getByRole('button', { name: 'Visible to restaurant' }).click()
  await page.getByRole('textbox', { name: 'Write an internal note, only Ops can see it' }).fill(note)
  await page.getByLabel('Choose photos').setInputFiles(await bigPhoto(page))
  await expect(page.getByRole('list', { name: 'Photos to send' }).getByRole('img')).toHaveCount(1)
  await page.waitForTimeout(200)
  await testInfo.attach('internal', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('button', { name: 'Post update' }).click()
  await expect(log.getByText(note)).toBeVisible()
  await expect(log.getByRole('img', { name: 'Photo from You' }).last()).toBeVisible()
  // It stays on internal after posting.
  await page.getByRole('button', { name: 'Add update' }).click()
  await expect(page.getByRole('button', { name: 'Internal note · Ops only' })).toBeVisible()

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, 'dana.ortiz@example.com')
  await dana.goto(`/tickets/${T1047}`)
  const hers = dana.getByRole('log', { name: 'Ticket updates' })
  await expect(hers.getByText(visible)).toBeVisible()
  await expect(hers.getByText(note)).toHaveCount(0)
  await expect(hers.getByText('Ops only')).toHaveCount(0)
  await context.close()
})

test('a post that fails keeps what was written', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1047}`)
  await page.route('**/rest/v1/rpc/post_ticket_update', (route) =>
    route.fulfill({ status: 500, json: { message: 'nope' } }),
  )
  await page.getByRole('button', { name: 'Add update' }).click()
  const box = page.getByRole('textbox', { name: 'Write an update the restaurant can see' })
  await box.fill('Still here')
  await page.getByRole('button', { name: 'Post update' }).click()
  await expect(page.getByRole('alert')).toContainText("Couldn't post that yet.")
  await expect(box).toHaveValue('Still here')
})

test('a reopened ticket is an ordinary ticket with its badge, and nobody on it', async ({
  page,
  browser,
  request,
}, testInfo) => {
  const title = `Reopen ${testInfo.project.name} ${Date.now() % 100000}`
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, 'dana.ortiz@example.com')
  await dana.goto('/tickets/new?area=boh')
  await dana.getByRole('link', { name: /^Refrigeration/ }).click()
  await dana.getByLabel('Title').fill(title)
  await dana.getByRole('button', { name: 'Submit ticket' }).click()
  await dana.getByRole('button', { name: 'Proceed without photo' }).click()
  await dana.getByRole('link', { name: new RegExp(title) }).click()
  await expect(dana.getByRole('heading', { name: title })).toBeVisible()
  const ticketUrl = new URL(dana.url()).pathname
  const id = ticketUrl.split('/').pop()!

  // Bert works on it and closes it, then Dana reopens it.
  const headers = { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, BERT)}` }
  const worked = await request.post(`${SUPABASE}/rest/v1/rpc/set_ticket_status`, {
    headers,
    data: { p_id: id, p_status: 'in_progress' },
  })
  expect(worked.ok()).toBe(true)
  const closed = await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${id}`, {
    headers,
    data: { status: 'closed', resolution: 'Swapped the relay.' },
  })
  expect(closed.ok()).toBe(true)
  await dana.goto(ticketUrl)
  await dana.getByRole('button', { name: 'Reopen ticket' }).click()
  await dana.getByLabel("What's happening?").fill('It is warm again.')
  await dana.getByRole('dialog').getByRole('button', { name: 'Reopen ticket' }).click()
  await expect(dana.getByText(/Reopened and sent to Ops\./)).toBeVisible()
  await expect(dana.getByText(/You'll get a notification when work starts\./)).toBeVisible()
  await context.close()

  await signIn(page, BERT)
  const card = page.getByRole('link', { name: new RegExp(title) })
  await expect(card).toContainText('Reopened')
  await expect(card.getByTitle(/is working on this/)).toHaveCount(0)
  // Minutes old, but reopened, so no new-ticket ring.
  await expect(card).not.toContainText('New ticket.')
  await card.click()

  await expect(statusButton(page)).toContainText('Reopened')
  await expect(onIt(page)).toContainText('Nobody yet')
  await expect(page.getByRole('log', { name: 'Ticket updates' }).getByText('It is warm again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add update' })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('reopened', { body: await page.screenshot(), contentType: 'image/png' })

  await pick(page, 'In progress')
  await expect(onIt(page)).toContainText('You')
  await statusButton(page).click()
  await expect(page.getByRole('menuitem', { name: 'Close ticket' })).toBeVisible()
})

test('Ops closes a ticket with a comment, and the restaurant sees it', async ({ page, browser }, testInfo) => {
  // Its own ticket, since a closed one doesn't come back.
  const title = `Close from Ops ${testInfo.project.name} ${Date.now() % 100000}`
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, 'dana.ortiz@example.com')
  await dana.goto('/tickets/new?area=boh')
  await dana.getByRole('link', { name: /^Refrigeration/ }).click()
  await dana.getByLabel('Title').fill(title)
  await dana.getByRole('button', { name: 'Submit ticket' }).click()
  await dana.getByRole('button', { name: 'Proceed without photo' }).click()
  await dana.getByRole('link', { name: new RegExp(title) }).click()
  await expect(dana.getByRole('heading', { name: title })).toBeVisible()
  const ticketUrl = new URL(dana.url()).pathname

  await signIn(page, BERT)
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await statusButton(page).click()
  await page.getByRole('menuitem', { name: 'Close ticket' }).click()
  const sheet = page.getByRole('dialog', { name: /^Close OT-\d+\?$/ })
  await sheet.getByLabel('Comment').fill('Replaced the compressor relay.')
  await page.waitForTimeout(300)
  await testInfo.attach('close-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Close ticket' }).click()

  await expect(page).toHaveURL(/\/ops$/)
  await expect(page.getByRole('status').filter({ hasText: /OT-\d+ closed\./ })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)

  await dana.goto(ticketUrl)
  await expect(dana.getByRole('heading', { name: 'Closed ticket' })).toBeVisible()
  await expect(dana.getByText('Replaced the compressor relay.')).toBeVisible()
  await context.close()
})
