import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Admin · Tickets and Ticket detail, view only (Admin-Tickets, Admin-Ticket, OT-148)
 * against the seed: OT-1042 at Logan Square, urgent, with Bert on it and Coldline's visit;
 * OT-1036 at West Loop, closed. Other flows open, close and reopen tickets as they run,
 * so this looks for those two rather than counting. It only reads.
 */

test.use({ timezoneId: 'America/Chicago' })

const T1042 = '66666666-6666-4666-8666-000000001042'

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

test('the admin reads every restaurant’s tickets and a ticket, and can change nothing', async ({ page }, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Tickets' }).click()
  await expect(page).toHaveURL(/\/admin\/tickets$/)
  await expect(page.getByRole('heading', { name: 'Tickets', level: 1 })).toBeVisible()
  await expect(page.getByText(/^View only · .+ manages tickets$/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Open · \d+$/ })).toBeVisible()

  const card = page.getByRole('link', { name: /Walk-in cooler not holding temp/ })
  await expect(card).toContainText('Federale’s Logan Square')
  await expect(card).toContainText('URGENT')
  await expect(card).toContainText('OT-1042')
  await expect(card).toContainText('Bert Velilla')
  await shot(page, testInfo, 'tickets')

  // Search by number, however it is typed.
  await page.getByRole('searchbox', { name: 'Search tickets' }).fill('ot1042')
  await expect(page.getByRole('link', { name: /OT-\d+/ })).toHaveCount(1)
  await page.getByRole('searchbox', { name: 'Search tickets' }).fill('no such ticket anywhere')
  await expect(page.getByRole('heading', { name: 'No tickets match "no such ticket anywhere"' })).toBeVisible()
  await page.getByText('Clear search', { exact: true }).click()

  // The restaurant chip narrows the list.
  await page.getByRole('button', { name: 'Restaurant: All restaurants' }).click()
  await page.getByRole('menuitemradio', { name: 'Porter' }).click()
  await expect(page.getByRole('button', { name: 'Restaurant: Porter' })).toBeVisible()
  await expect(card).toHaveCount(0)
  await page.getByRole('button', { name: 'Restaurant: Porter' }).click()
  await page.getByRole('menuitemradio', { name: /^All restaurants/ }).click()

  // The ticket, read-only: no way to write, no internal note, and its visit opens nothing.
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/admin/tickets/${T1042}$`))
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp' })).toBeVisible()
  await expect(page.getByText('Bert Velilla', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Coldline Refrigeration/).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Coldline Refrigeration/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Add update|Status/ })).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByText(/Coldline quoted \$185/)).toHaveCount(0)
  await expect(page.getByText(/You can view this ticket but not change it\./)).toBeVisible()
  await shot(page, testInfo, 'ticket')

  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(/\/admin\/tickets$/)
})

test('Closed lists closed tickets, each opening read-only', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/tickets')
  await page.getByRole('button', { name: 'Closed', exact: true }).click()
  const closed = page.getByRole('link', { name: /Ice machine scale buildup/ })
  await expect(closed).toContainText('Federale’s West Loop')
  await expect(closed).toContainText(/Closed Oct 17/)
  await closed.click()
  await expect(page).toHaveURL(/\/admin\/tickets\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Resolution', { exact: true })).toBeVisible()
  await expect(page.getByRole('paragraph').filter({ hasText: 'Coldline descaled the unit' })).toBeVisible()
})
