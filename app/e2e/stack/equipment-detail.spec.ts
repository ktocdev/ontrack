import { expect, test, type Page } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Equipment details against the seed: Walk-in Cooler 1 at Logan Square has OT-1042 open,
 * older closed tickets and service from 2025 and 2026. Maya manages Logan Square with See
 * costs by override; Ari manages Ranalli's without it; Bert is Ops everywhere. Other flows
 * add tickets as they run, so counts are read as patterns.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const COOLER = '44444444-4444-4444-8444-000000000001'
const T1042 = '66666666-6666-4666-8666-000000001042'
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Equipment views' })

test('a manager opens a unit from its ticket and sees its details', async ({ page }, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/tickets/${T1042}`)
  await page.getByRole('link', { name: /Walk-in Cooler 1/ }).click()
  await expect(page).toHaveURL(new RegExp(`/equipment/${COOLER}$`))

  await expect(page.getByRole('heading', { name: 'Walk-in Cooler 1', level: 1 })).toBeVisible()
  await expect(page.getByText('Federale’s Logan Square').first()).toBeVisible()
  await expect(page.getByText('› BOH › Refrigeration')).toBeVisible()
  await expect(page.getByText('Serial number')).toBeVisible()
  await expect(page.getByText(/QR/)).toHaveCount(0)
  const details = page.getByRole('region', { name: 'Details' })
  await expect(details).toContainText('Kolpak')
  await expect(details).toContainText('KF7-0810-CT')
  await expect(details).toContainText('Back of House · Refrigeration')
  await expect(details).toContainText('Kitchen, north wall')
  await expect(details).toContainText('Mar 2022')
  // The seed names a manual it never uploads, so it can't be signed and shows as its name.
  await expect(details).toContainText('Kolpak-KF7.pdf')
  await expect(tabs(page).getByRole('link', { name: /Tickets \d+ open/ })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('details', { body: await page.screenshot(), contentType: 'image/png' })

  // Tickets: open on top, closed under a disclosure, each opening the ticket.
  await tabs(page)
    .getByRole('link', { name: /Tickets/ })
    .click()
  await expect(page).toHaveURL(new RegExp(`/equipment/${COOLER}/tickets$`))
  await expect(page.getByText('Kolpak · KP-7XW-220418')).toBeVisible()
  const open = page.getByRole('region', { name: 'Open tickets' })
  await expect(open.getByRole('link', { name: /OT-1042/ })).toBeVisible()
  const closed = page.getByRole('region', { name: 'Closed tickets' })
  await expect(closed.getByRole('link', { name: /Evaporator fan noisy/ })).toContainText(/Closed May 3, 2026/)
  await expect(closed.getByRole('link', { name: /Evaporator fan noisy/ })).toContainText('$38.50')
  await page.waitForTimeout(300)
  await testInfo.attach('tickets', { body: await page.screenshot(), contentType: 'image/png' })
  await closed.getByRole('button', { name: /Closed · \d+/ }).click()
  await expect(closed.getByRole('link')).toHaveCount(0)
  await closed.getByRole('button', { name: /Closed · \d+/ }).click()
  await open.getByRole('link', { name: /OT-1042/ }).click()
  await expect(page).toHaveURL(new RegExp(`/tickets/${T1042}$`))
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/equipment/${COOLER}/tickets$`))

  // A manager has no Service & cost, even with See costs (from feedback); closed tickets keep their cost.
  await expect(tabs(page).getByRole('link', { name: 'Service & cost' })).toHaveCount(0)
  await page.goto(`/equipment/${COOLER}/service`)
  await expect(page).toHaveURL(new RegExp(`/equipment/${COOLER}$`))
})

test('without See costs there is no Service & cost, and another restaurant’s unit is not found', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  const ice = '44444444-4444-4444-8444-000000000014'
  await page.goto(`/equipment/${ice}`)
  await expect(page.getByRole('heading', { name: 'Ice Machine', level: 1 })).toBeVisible()
  await expect(tabs(page).getByRole('link', { name: 'Service & cost' })).toHaveCount(0)
  await page.goto(`/equipment/${ice}/service`)
  await expect(page).toHaveURL(new RegExp(`/equipment/${ice}$`))

  await page.goto(`/equipment/${COOLER}`)
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
  await page.goto('/equipment/not-a-unit')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})

test('Ops sees the restaurant, Installed, the details in a card and Service & cost, and its ticket opens the unit', async ({
  page,
}, testInfo) => {
  await signIn(page, 'bert.velilla@example.com')
  await page.goto(`/ops/tickets/${T1042}`)
  await page.getByRole('link', { name: /Walk-in Cooler 1/ }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/equipment/${COOLER}$`))
  await expect(page.getByText(/Installed Mar 2022/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Details' })).toContainText('Restaurant')
  await expect(tabs(page).getByRole('link', { name: /Tickets \d+ open/ })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('ops details', { body: await page.screenshot(), contentType: 'image/png' })

  await tabs(page)
    .getByRole('link', { name: /Tickets/ })
    .click()
  await page
    .getByRole('region', { name: 'Closed tickets' })
    .getByRole('link', { name: /Evaporator fan noisy/ })
    .click()
  await expect(page).toHaveURL(/\/ops\/tickets\/66666666-6666-4666-8666-000000000911$/)
  await page.goBack()

  // Service & cost, with See costs: totals, the contractor, the log by year.
  await tabs(page).getByRole('link', { name: 'Service & cost' }).click()
  await expect(page.getByText('Lifetime cost')).toBeVisible()
  await expect(page.getByText(/^Visits \d{4}$/)).toBeVisible()
  const contractors = page.getByRole('region', { name: 'Contractors on this unit' })
  await expect(contractors).toContainText('Coldline Refrigeration')
  // Other flows log visits on this unit as they run (OT-92), so any amount.
  await expect(contractors).toContainText(/\$[\d,]+\.\d\d|No visits in \d{4}/)
  await expect(contractors.getByRole('link', { name: 'Call Coldline Refrigeration' })).toHaveAttribute('href', /^tel:/)
  const log = page.getByRole('region', { name: 'Service log 2026' })
  await expect(log).toContainText('Condenser fan motor replaced')
  await expect(log).toContainText('OT-0911 · In-house')
  await expect(page.getByRole('region', { name: 'Service log 2025' })).toContainText('Spring PM and door closer')
  await page.waitForTimeout(300)
  await testInfo.attach('service', { body: await page.screenshot(), contentType: 'image/png' })
})

test('a new unit has no tickets and no service yet', async ({ page, request }) => {
  const token = await tokenFor(request, 'bert.velilla@example.com')
  const headers = { apikey: KEY, Authorization: `Bearer ${token}`, Prefer: 'return=representation' }
  const added = await request.post(`${SUPABASE}/rest/v1/equipment`, {
    headers,
    data: {
      restaurant_id: '11111111-1111-4111-8111-000000000001',
      category_id: '33333333-3333-4333-8333-000000000012',
      name: `Test reach-in ${Date.now()}`,
      warranty_note: 'Parts through Oct 2029',
    },
  })
  expect(added.ok()).toBe(true)
  const [{ id }] = (await added.json()) as { id: string }[]

  await signIn(page, 'bert.velilla@example.com')
  await page.goto(`/ops/equipment/${id}/tickets`)
  await expect(page.getByRole('heading', { name: 'No tickets yet' })).toBeVisible()
  await expect(tabs(page).getByRole('link', { name: /open/ })).toHaveCount(0)
  await page.goto(`/ops/equipment/${id}/service`)
  await expect(page.getByRole('heading', { name: 'No service logged yet' })).toBeVisible()
  await expect(page.getByText('Warranty: Parts through Oct 2029.')).toBeVisible()

  const deleted = await request.post(`${SUPABASE}/rest/v1/rpc/delete_equipment`, { headers, data: { p_id: id } })
  expect(deleted.ok()).toBe(true)
})

test('Closed tickets says closed tickets also appear on each unit', async ({ page }) => {
  // The note sits above a month with closings, and the seed's are in October 2026, so the
  // browser is put in that month; otherwise the test turns on whether anything has closed
  // this month (OT-73).
  await page.clock.setFixedTime(new Date('2026-10-28T12:00:00'))
  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/ops/closed')
  await expect(page.getByText('Closed tickets also appear on each piece of equipment, with their costs.')).toBeVisible()
})
