import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Categories (OT-86) against the seed: Bert is Ops with Add / edit equipment, Maya manages
 * Logan Square. Each test adds its own category and deletes it, since the seed's are
 * what the other flows count; Refrigeration is in use and only looked at.
 */

const openCategories = async (page: Page) => {
  await signIn(page, 'bert.velilla@example.com')
  await page.getByRole('link', { name: 'Equipment' }).click()
  await page.getByRole('button', { name: 'More options for equipment' }).click()
  await page.getByRole('menuitem', { name: 'Categories' }).click()
  await expect(page.getByRole('heading', { name: 'Categories', level: 1 })).toBeVisible()
}
const row = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) })

test('Ops adds, renames, turns off and on, and deletes a category, and Create ticket follows', async ({
  page,
  browser,
  browserName,
}, testInfo) => {
  const name = `Patio ${browserName}`
  await openCategories(page)
  await page.getByRole('radio', { name: 'Back of House' }).click()
  await expect(row(page, 'Refrigeration')).toBeVisible()

  // Add, and a name already taken is refused.
  await page.getByRole('button', { name: 'Add category' }).click()
  let sheet = page.getByRole('dialog', { name: 'Add category' })
  await expect(sheet.getByRole('radio', { name: 'Back of House' })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByLabel('Name').fill('refrigeration')
  await sheet.getByRole('button', { name: 'Add category' }).click()
  await expect(sheet.getByText('There is already a category with that name here.')).toBeVisible()
  await sheet.getByLabel('Name').fill(name)
  await page.waitForTimeout(250)
  await testInfo.attach('add', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Add category' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} added.` })).toBeVisible()
  await expect(row(page, name)).toContainText('Not used yet')

  // A manager sees it in Create ticket.
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const maya = await context.newPage()
  await signIn(maya, 'maya.reyes@example.com')
  await maya.goto('/tickets/new?area=boh')
  await expect(maya.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible()

  // Rename.
  await row(page, name).click()
  sheet = page.getByRole('dialog', { name })
  await sheet.getByRole('button', { name: 'Rename category' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill(`${name} & sidewalk`)
  await page.getByRole('dialog').getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByRole('status').filter({ hasText: `Renamed to ${name} & sidewalk.` })).toBeVisible()
  const renamed = `${name} & sidewalk`

  // Turn off: under Turned off, and gone from Create ticket.
  await row(page, renamed).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn off category' }).click()
  await expect(page.getByRole('dialog', { name: `Turn off ${renamed}?` })).toContainText('keep it')
  await page.getByRole('dialog').getByRole('button', { name: 'Turn off category' }).click()
  await expect(page.getByText('Turned off', { exact: true })).toBeVisible()
  await expect(row(page, renamed)).toContainText('Off')
  await page.waitForTimeout(250)
  await testInfo.attach('turned off', { body: await page.screenshot(), contentType: 'image/png' })
  await maya.reload()
  await expect(maya.getByRole('link', { name: /^Refrigeration/ })).toBeVisible()
  await expect(maya.getByRole('link', { name: new RegExp(`^${name}`) })).toHaveCount(0)
  await context.close()

  // Turn on, then delete, since nothing used it.
  await row(page, renamed).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn on category' }).click()
  await expect(page.getByText('Turned off', { exact: true })).toHaveCount(0)
  await row(page, renamed).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete category' }).click()
  await page
    .getByRole('dialog', { name: `Delete ${renamed}?` })
    .getByRole('button', { name: 'Delete category' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: `${renamed} deleted.` })).toBeVisible()
  await expect(row(page, renamed)).toHaveCount(0)
})

test('a category in use can be turned off but not deleted, and says why', async ({ page }, testInfo) => {
  await openCategories(page)
  await page.getByRole('radio', { name: 'Back of House' }).click()
  await row(page, 'Refrigeration').click()
  const sheet = page.getByRole('dialog', { name: 'Refrigeration' })
  await expect(sheet.getByRole('button', { name: 'Delete category' })).toBeDisabled()
  await expect(sheet.getByText('Tickets or equipment use it, so it can be turned off but not deleted.')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Turn off category' })).toBeEnabled()
  await page.waitForTimeout(250)
  await testInfo.attach('in use', { body: await page.screenshot(), contentType: 'image/png' })
})

test('an admin opens Categories from Restaurants', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants')
  await page.getByRole('link', { name: /^Categories/ }).click()
  await expect(page).toHaveURL(/\/admin\/restaurants\/categories$/)
  await expect(page.getByRole('button', { name: 'Add category' })).toBeVisible()
  await expect(row(page, 'POS & tech')).toBeVisible()
})

test('a manager has no way to Categories, and the Ops address is refused', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/ops/equipment/categories')
  await expect(page.getByRole('button', { name: 'Add category' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Categories', level: 1 })).toHaveCount(0)
})
