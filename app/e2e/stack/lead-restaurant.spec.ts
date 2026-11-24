import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Leadership · Restaurant view (Exec-Restaurant, Empty-Exec-Restaurant, OT-144) against
 * the seed: Logan Square's open tickets with what is logged on each (read as Ops reads it,
 * since other flows log service), its Reporter, the picker, the Equipment tab, and the
 * empty state. It only reads.
 */

test.use({ timezoneId: 'America/Chicago' })

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const LEE = 'lee.chen@example.com'
const LOGAN = '11111111-1111-4111-8111-000000000001'
const RANALLIS = '11111111-1111-4111-8111-000000000004'
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
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

test('a restaurant’s open tickets with what is logged on each, its Reporter, the picker and its equipment', async ({
  page,
  request,
}, testInfo) => {
  const open = await asOps<{ id: string; display_id: string }>(
    request,
    `tickets?select=id,display_id&restaurant_id=eq.${LOGAN}&status=neq.closed`,
  )
  const costs = await asOps<{ ticket_id: string; total_cents: number }>(
    request,
    `v_ticket_costs?select=ticket_id,total_cents&ticket_id=in.(${open.map((t) => t.id).join(',')})`,
  )
  const costed = open.find((t) => costs.some((c) => c.ticket_id === t.id && c.total_cents > 0))!
  const bare = open.find((t) => !costs.some((c) => c.ticket_id === t.id && c.total_cents > 0))!
  expect(costed && bare, 'Logan Square has open tickets with and without a cost').toBeTruthy()

  await signIn(page, LEE)
  await page.goto(`/lead/restaurants?restaurant=${LOGAN}`)
  await expect(page).toHaveURL(new RegExp(`/lead/restaurants/${LOGAN}$`))
  await expect(page.getByText('READ-ONLY VIEW')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Federale’s Logan Square' })).toBeVisible()
  await expect(page.getByText('Manager: Maya Reyes')).toBeVisible()
  await expect(page.getByRole('link', { name: `Open tickets · ${open.length}` })).toBeVisible()
  // Ticket cards, not New ticket's link to /lead/tickets/new (OT-170).
  const cards = page.locator('a[href^="/lead/tickets/"]:not([href^="/lead/tickets/new"])')
  await expect(cards).toHaveCount(open.length)
  const cost = costs.find((c) => c.ticket_id === costed.id)!.total_cents
  await expect(cards.filter({ hasText: costed.display_id })).toContainText(`${money(cost)} logged`)
  await expect(cards.filter({ hasText: bare.display_id })).toContainText('No cost yet')
  await expect(cards.filter({ hasText: costed.display_id })).toHaveAttribute('href', `/lead/tickets/${costed.id}`)
  await shot(page, testInfo, 'restaurant · open tickets')

  // The title picks another restaurant.
  await page.getByRole('button', { name: /Federale’s Logan Square/ }).click()
  await page.getByRole('menuitemradio', { name: 'Porter' }).click()
  await expect(page.getByRole('heading', { name: 'Porter' })).toBeVisible()
  await expect(page.getByText('Manager: Dana Ortiz')).toBeVisible()

  // Equipment, by area and type, opening nothing.
  await page.goto(`/lead/restaurants/${LOGAN}`)
  await page.getByRole('link', { name: 'Equipment' }).click()
  await expect(page).toHaveURL(new RegExp(`/lead/restaurants/${LOGAN}/equipment$`))
  await page.getByRole('radio', { name: 'Back of House' }).click()
  await page.getByRole('button', { name: /^Refrigeration/ }).click()
  await expect(page.getByText('Walk-in Cooler 1')).toBeVisible()
  await expect(page.locator('a[href*="/equipment/"]')).toHaveCount(0)
  await shot(page, testInfo, 'restaurant · equipment')
})

test('with nothing open, a restaurant says when its last ticket closed', async ({ page }, testInfo) => {
  const [last] = await asOps<{ closed_at: string }>(
    page.request,
    `tickets?select=closed_at&restaurant_id=eq.${RANALLIS}&status=eq.closed&order=closed_at.desc&limit=1`,
  )
  await signIn(page, LEE)
  // The seed has open tickets everywhere, so the open list comes back empty.
  await page.route('**/rest/v1/tickets?select=id%2Cdisplay_id%2Ctitle*', (route) =>
    route.fulfill({ json: [], headers: { 'content-range': '*/0' } }),
  )
  await page.goto(`/lead/restaurants/${RANALLIS}`)
  await expect(page.getByRole('link', { name: 'Open tickets · 0' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No open tickets' })).toBeVisible()
  const day = new Date(last!.closed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })
  await expect(
    page.getByText(`Nothing needs attention at Ranalli’s Logan Square right now. Last ticket closed ${day}.`),
  ).toBeVisible()
  await shot(page, testInfo, 'restaurant · no open tickets')
})
