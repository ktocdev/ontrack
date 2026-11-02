import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Ops · Ticket against the seed. Status changes happen on OT-1047, an open ticket at
 * Porter nobody has, which is put back around each test, since other flows read it as open.
 */

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
  await expect(page.getByText('Maya Reyes')).toBeVisible()
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
  await expect(page.getByRole('note')).toContainText('Nobody has this yet')

  await pick(page, 'In progress')
  await expect(statusButton(page)).toContainText('In progress')
  await expect(onIt(page)).toContainText('You')
  await expect(page.getByRole('note')).toHaveCount(0)

  await pick(page, 'Open')
  await expect(page.getByRole('note')).toBeVisible()
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

test('a closed ticket can’t change here, and a ticket out of scope isn’t there', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto('/ops/tickets/66666666-6666-4666-8666-000000001028')
  await expect(statusButton(page)).toBeDisabled()
  await page.goto('/ops/tickets/not-a-ticket')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})
