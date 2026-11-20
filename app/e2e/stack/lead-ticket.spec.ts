import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Leadership · Ticket and Service record, read-only (Exec-Ticket, Exec-Service-Record,
 * OT-145) against the seed's OT-1042 at Logan Square: Bert is on it, Coldline's visit has
 * its invoice, and Ops left an internal note that leadership must not see. It only reads.
 */

test.use({ timezoneId: 'America/Chicago' })

const LEE = 'lee.chen@example.com'
const LOGAN = '11111111-1111-4111-8111-000000000001'
const T1042 = '66666666-6666-4666-8666-000000001042'

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

test('leadership reads a ticket and its service record, and can change neither', async ({ page }, testInfo) => {
  await signIn(page, LEE)
  await page.goto(`/lead/restaurants/${LOGAN}`)
  await page.locator(`a[href="/lead/tickets/${T1042}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/lead/tickets/${T1042}$`))

  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp' })).toBeVisible()
  await expect(page.getByText(/^Federale’s Logan Square · by Maya Reyes, Oct 19/)).toBeVisible()
  await expect(page.getByText('URGENT', { exact: true })).toBeVisible()
  await expect(page.getByText('On it')).toBeVisible()
  await expect(page.getByText('Bert Velilla', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Back of House › Refrigeration')).toBeVisible()
  await expect(page.getByText('Walk-in Cooler 1', { exact: true })).toBeVisible()
  // Other flows may log another Coldline visit on it; the seed's is Oct 19's.
  const visit = page.getByRole('link', { name: /Coldline Refrigeration Oct 19, 2026/ })
  await expect(visit).toContainText('Invoice attached')
  await expect(visit).toContainText('$397.40')
  await expect(page.getByText(/You can view this ticket but not change it\./)).toBeVisible()
  // Nothing to write with, and no internal note.
  await expect(page.getByRole('button', { name: /Add update|Status/ })).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByText(/Coldline quoted \$185/)).toHaveCount(0)
  await shot(page, testInfo, 'ticket')

  // The visit opens its service record, read-only.
  await visit.click()
  await expect(page).toHaveURL(/\/lead\/service\/[0-9a-f-]{36}$/)
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Condenser fan motor replaced' })).toBeVisible()
  await expect(page.getByText('Walk-in Cooler 1 · Federale’s Logan Square').first()).toBeVisible()
  // The seed's invoice has no file in Storage, so there is nothing to sign for View here.
  await expect(page.getByText('Coldline_INV-58213.pdf')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Replace|Attach/ })).toHaveCount(0)
  await shot(page, testInfo, 'service record')

  // Back returns to the ticket, and its Back to the restaurant.
  await page.getByRole('link', { name: /^Back/ }).click()
  await expect(page).toHaveURL(new RegExp(`/lead/tickets/${T1042}$`))
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(new RegExp(`/lead/restaurants/${LOGAN}$`))
})

test('a ticket’s lasting link opens leadership’s ticket', async ({ page }) => {
  await signIn(page, LEE)
  await page.goto('/t/ot1042')
  await expect(page).toHaveURL(new RegExp(`/lead/tickets/${T1042}$`))
  await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp' })).toBeVisible()
})
