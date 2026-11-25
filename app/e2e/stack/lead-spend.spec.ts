import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Leadership · Spend (OT-178, no board): the Overview's Spend card opens what it adds up, for
 * the same month. The figures come from the database as Ops reads them (Bert), so the page's
 * total and visits match the card's, and a visit opens its service record and comes back to
 * the same month. It only reads.
 */

test.use({ timezoneId: 'America/Chicago' })

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const LEE = 'lee.chen@example.com'
const LEE_ID = '22222222-2222-4222-8222-000000000005'
const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

async function asOps<T>(request: APIRequestContext, path: string): Promise<T[]> {
  const token = await tokenFor(request, 'bert.velilla@example.com')
  const res = await request.get(`${SUPABASE}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()) as T[]
}

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

/** A figure tile by its label. */
const tile = (page: Page, label: string | RegExp) =>
  page
    .locator('div, a')
    .filter({ has: page.getByText(label, { exact: true }) })
    .last()

test('the Overview’s Spend opens what it adds up: by restaurant, contractor and category, and every visit', async ({
  page,
  request,
}, testInfo) => {
  const october = await asOps<{ spend_cents: number; visits: number }>(
    request,
    'v_overview_by_month?select=spend_cents,visits&month=eq.2026-10-01',
  )
  const spend = october.reduce((n, r) => n + r.spend_cents, 0)
  const visits = october.reduce((n, r) => n + r.visits, 0)
  expect(spend, 'the seed has spend in October').toBeGreaterThan(0)

  await signIn(page, LEE)
  await page.goto('/lead?month=2026-10')
  const card = page.getByRole('link', { name: /Spend · October/ })
  await expect(card).toContainText(money(spend))
  await card.click()

  await expect(page).toHaveURL(/\/lead\/spend\?month=2026-10$/)
  await expect(page.getByRole('heading', { name: 'Spend', level: 1 })).toBeVisible()
  await expect(page.getByText('October 2026')).toBeVisible()
  await expect(tile(page, /^Spend · October/)).toContainText(money(spend))
  await expect(tile(page, /^Visits/)).toContainText(String(visits))

  // A row per restaurant, then each contractor with in-house work as one line, then categories.
  await expect(page.getByRole('region', { name: 'By restaurant · October' }).getByText(/\d+ visits?$/)).toHaveCount(4)
  const contractors = page.getByRole('region', { name: 'By contractor' })
  await expect(contractors.getByRole('link', { name: /Coldline/ })).toBeVisible()
  await expect(contractors.getByText('In-house', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'By category' }).getByText('Refrigeration')).toBeVisible()
  const rows = page.getByRole('region', { name: `Visits · ${visits}` }).locator('a[href^="/lead/service/"]')
  await expect(rows).toHaveCount(visits)
  await shot(page, testInfo, 'spend · October')

  // A visit opens its service record, and Back comes to the same month.
  await rows.first().click()
  await expect(page).toHaveURL(/\/lead\/service\/[0-9a-f-]{36}$/)
  await page.getByRole('link', { name: /^Back/ }).first().click()
  await expect(page).toHaveURL(/\/lead\/spend\?month=2026-10$/)

  // On a laptop the visit opens beside the list.
  await page.setViewportSize({ width: 1280, height: 800 })
  await rows.first().click()
  await expect(page).toHaveURL(/\/lead\/service\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Spend', level: 1 })).toBeVisible()
  await shot(page, testInfo, 'spend · laptop')

  // Back to the Overview keeps the month.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/lead/spend?month=2026-10')
  await page.getByRole('link', { name: 'Back to Overview' }).click()
  await expect(page).toHaveURL(/\/lead\?month=2026-10$/)
})

test('under View as, Spend on the Overview opens nothing', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto(`/admin/users/${LEE_ID}/view`)
  await expect(page.getByText('Viewing as Lee Chen')).toBeVisible()
  await expect(tile(page, /^Spend · /)).toBeVisible()
  await expect(page.locator('a[href^="/lead/spend"]')).toHaveCount(0)
})
