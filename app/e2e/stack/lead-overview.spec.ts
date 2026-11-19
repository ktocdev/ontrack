import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Leadership · Overview (Exec-Overview, OT-143) against the seed. The figures come from the
 * database as Ops reads them (Bert), so the test says what the done test asks: leadership
 * sees the same totals Ops sees. Open and Urgent are what is open now; Spend and the rows
 * are October's, every visit dated in it. It only reads.
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
    .locator('div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .last()

test('leadership’s Overview shows what Ops sees: open now, and a month’s spend by restaurant', async ({
  page,
  request,
}, testInfo) => {
  const open = await asOps<{ open_count: number; urgent_count: number }>(
    request,
    'v_restaurant_open_counts?select=open_count,urgent_count',
  )
  const october = await asOps<{ restaurant_id: string; spend_cents: number }>(
    request,
    'v_overview_by_month?select=restaurant_id,spend_cents&month=eq.2026-10-01',
  )
  const openNow = open.reduce((n, r) => n + r.open_count, 0)
  const urgentNow = open.reduce((n, r) => n + r.urgent_count, 0)
  const spend = october.reduce((n, r) => n + r.spend_cents, 0)
  const most = Math.max(...october.map((r) => r.spend_cents))
  expect(spend, 'the seed has spend in October').toBeGreaterThan(0)

  await signIn(page, LEE)
  await expect(page).toHaveURL(/\/lead$/)
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(tile(page, 'Open tickets')).toContainText(String(openNow))
  await expect(tile(page, 'Urgent')).toContainText(String(urgentNow))
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled()
  await shot(page, testInfo, 'overview · this month')

  // October: every visit dated in it, a row per restaurant, the most spent first.
  await page.goto('/lead?month=2026-10')
  await expect(page.getByText('October 2026')).toBeVisible()
  await expect(tile(page, /^Spend · October/)).toContainText(money(spend))
  await expect(tile(page, 'Open tickets')).toContainText(String(openNow))
  const rows = page.locator('a[href^="/lead/restaurants/"]')
  await expect(rows).toHaveCount(4)
  await expect(rows.first()).toContainText(money(most))
  await expect(rows.first()).toContainText(/\d+ open/)
  await shot(page, testInfo, 'overview · October')

  // On a laptop the four figures sit in one row.
  await page.setViewportSize({ width: 1280, height: 800 })
  const tops = await Promise.all(
    ['Open tickets', 'Urgent', /^Spend · October/, 'Avg. time to close'].map(async (l) =>
      Math.round((await tile(page, l).boundingBox())!.y),
    ),
  )
  expect(new Set(tops).size, 'one row of figures').toBe(1)
  await shot(page, testInfo, 'overview · laptop')

  // A row opens the restaurant.
  await rows.first().click()
  await expect(page).toHaveURL(/\/lead\/restaurants\/[0-9a-f-]{36}$/)
})

test('View as shows leadership’s Overview, and its rows open nothing', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto(`/admin/users/${LEE_ID}/view`)
  await expect(page.getByText('Viewing as Lee Chen')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(tile(page, 'Open tickets')).toBeVisible()
  await expect(page.getByText(/^\d+ open/).first()).toBeVisible()
  await expect(page.locator('a[href^="/lead/restaurants"]')).toHaveCount(0)
})
