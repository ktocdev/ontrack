import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * The Invoices tab (OT-96) against the seed. Other flows log visits at Logan Square as
 * they run, so these tests look at Porter, whose two October visits are Northstar's
 * NS-4410 ($186.60) and Hobart's H-20931 ($640.00), and at Ranalli's, whose October
 * contractor visit has no invoice (Pipeworks, $165.00) and whose in-house work isn't one.
 */

test.use({ timezoneId: 'America/Chicago' })

async function openInvoices(page: Page, restaurant: string) {
  await signIn(page, 'bert.velilla@example.com')
  await page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: 'Contractors' }).click()
  await page.getByRole('navigation', { name: 'Contractors' }).getByRole('link', { name: 'Invoices' }).click()
  await expect(page).toHaveURL(/\/ops\/contractors\/invoices$/)
  await page.getByRole('button', { name: /All restaurants \(\d+\)/ }).click()
  await page.getByRole('menuitemradio', { name: restaurant }).click()
}
const rows = (page: Page) => page.getByRole('link', { name: /\$[\d,]+\.\d{2}/ })

test('a month at a restaurant: count, total, sort, search, and a row opening its record', async ({
  page,
}, testInfo) => {
  await openInvoices(page, 'Porter')
  // Porter has nothing this month, so the tab opens on its newest month with visits.
  await expect(page.getByRole('button', { name: 'Month: October 2026' })).toBeVisible()
  await expect(page.getByText('2 invoices', { exact: true })).toBeVisible()
  await expect(page.getByText('$826.60')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Missing · 0' })).toBeVisible()
  await expect(rows(page)).toHaveCount(2)
  await page.waitForTimeout(300)
  await testInfo.attach('invoices', { body: await page.screenshot(), contentType: 'image/png' })

  // Newest, Oldest, Amount: by amount Hobart's $640 comes first.
  await page.getByRole('button', { name: 'Sort: Newest. Tap to change.' }).click()
  await page.getByRole('button', { name: 'Sort: Oldest. Tap to change.' }).click()
  await expect(page.getByRole('button', { name: 'Sort: Amount. Tap to change.' })).toBeVisible()
  await expect(rows(page).first()).toContainText('Hobart Service')

  const search = page.getByRole('searchbox', { name: 'Search invoices' })
  await search.fill('ns-4410')
  await expect(page.getByText('1 invoice matches')).toBeVisible()
  await expect(page.getByText('$186.60').last()).toBeVisible()
  await search.fill('1023')
  await expect(rows(page)).toHaveCount(1)
  await rows(page).first().click()
  await expect(page.getByRole('heading', { name: 'Booster heater element replaced' })).toBeVisible()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(/\/ops\/contractors\/invoices$/)

  // Nothing matching says so and clears.
  await page.getByRole('searchbox', { name: 'Search invoices' }).fill('no such contractor')
  await expect(page.getByText('No invoices match.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search and filters' }).click()
  await expect(rows(page)).toHaveCount(2)
})

test('Missing narrows to visits with no invoice; in-house work is not an invoice', async ({ page }, testInfo) => {
  await openInvoices(page, 'Ranalli’s Logan Square')
  await expect(page.getByRole('button', { name: 'Month: October 2026' })).toBeVisible()
  await expect(page.getByText('1 invoice', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Missing · 1' }).click()
  await expect(page.getByText('1 invoice matches')).toBeVisible()
  const row = rows(page).first()
  await expect(row).toContainText('Pipeworks Plumbing')
  await expect(row).toContainText('Missing invoice')
  await expect(row).toHaveAccessibleName(/missing invoice$/)
  await page.waitForTimeout(300)
  await testInfo.attach('missing', { body: await page.screenshot(), contentType: 'image/png' })

  // Another month has none; All months has them all.
  await page.getByRole('button', { name: 'Month: October 2026' }).click()
  await page.getByRole('menuitemradio', { name: 'All months' }).click()
  await expect(page.getByRole('button', { name: 'Month: All months' })).toBeVisible()
  await expect(rows(page)).toHaveCount(1)

  // Directory and Invoices are tabs of one place.
  await page.getByRole('navigation', { name: 'Contractors' }).getByRole('link', { name: 'Directory' }).click()
  await expect(page).toHaveURL(/\/ops\/contractors$/)
  await expect(page.getByRole('searchbox', { name: 'Search contractors' })).toBeVisible()
})
