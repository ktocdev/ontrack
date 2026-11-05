import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Manager · Equipment against the seed: Maya manages Logan Square and has Add / edit
 * equipment by override; Ari manages Ranalli's without it. Other flows add tickets as
 * they run, so the open counts are read as patterns.
 */

const group = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const head = (page: Page, name: string) => group(page, name).getByRole('button').first()
const row = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(`^${name}`) })

async function openEquipment(page: Page, email: string) {
  await signIn(page, email)
  await page.getByRole('link', { name: 'Equipment' }).click()
  await expect(page.getByRole('heading', { name: 'Equipment', level: 1 })).toBeVisible()
}

test('a manager browses Front / Back, then a card per type, with no search', async ({ page }, testInfo) => {
  await openEquipment(page, 'maya.reyes@example.com')
  await expect(page.getByText('Federale’s Logan Square').first()).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Scan QR code' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Add equipment' })).toBeVisible()

  // Front of House first, its first type open.
  await expect(page.getByRole('radio', { name: 'Front of House' })).toHaveAttribute('aria-checked', 'true')
  await expect(head(page, 'Lighting')).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'Patio string lights')).toBeVisible()
  await expect(group(page, 'Cooking')).toHaveCount(0)

  await page.getByRole('radio', { name: 'Back of House' }).click()
  await expect(group(page, 'Lighting')).toHaveCount(0)
  await expect(head(page, 'Cooking')).toHaveAttribute('aria-expanded', 'true')
  await head(page, 'Refrigeration').click()
  await expect(head(page, 'Cooking')).toHaveAttribute('aria-expanded', 'false')
  await expect(head(page, 'Refrigeration')).toContainText(/\d+ open/)

  const cooler = row(page, 'Walk-in Cooler 1')
  await expect(cooler).toContainText('Kolpak · KP-7XW-220418')
  await expect(cooler).toContainText(/\d+ open/)
  await expect(cooler).not.toContainText(/spent|No cost/)
  await expect(cooler).not.toContainText('Federale’s Logan Square')

  await page.waitForTimeout(300)
  await testInfo.attach('manager equipment', { body: await page.screenshot(), contentType: 'image/png' })

  await cooler.click()
  await expect(page).toHaveURL(/\/equipment\/44444444-4444-4444-8444-000000000001$/)
})

test('a manager without Add / edit equipment sees only their restaurant and no Add', async ({ page }) => {
  await openEquipment(page, 'ari.kim@example.com')
  await expect(page.getByRole('link', { name: 'Add equipment' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Back of House' }).click()
  // Ranalli's has no cooking equipment, so Refrigeration comes first and is open.
  await expect(head(page, 'Refrigeration')).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'Ice Machine')).toHaveCount(1)
  await expect(row(page, 'Ice Machine')).toContainText('Manitowoc')
  await expect(row(page, 'Walk-in Cooler 1')).toHaveCount(0)
})

test('with no equipment it says so and offers a ticket by area', async ({ page }, testInfo) => {
  await page.route('**/rest/v1/equipment*', (route) => route.fulfill({ json: [] }))
  await openEquipment(page, 'maya.reyes@example.com')
  await expect(page.getByRole('heading', { name: 'No equipment yet' })).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Area' })).toHaveCount(0)
  await testInfo.attach('no equipment', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('link', { name: 'Create ticket by area' }).click()
  await expect(page).toHaveURL(/\/tickets\/new$/)
})
