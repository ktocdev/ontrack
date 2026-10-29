import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

/** Admin · Restaurants and Add restaurant against the seed. */

test('the list shows each restaurant with its manager or pending invite', async ({ page }, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants')
  await expect(page.getByRole('heading', { name: 'Restaurants' })).toBeVisible()
  await expect(page.getByText('Manager: Maya Reyes')).toBeVisible()
  await expect(page.getByText('Invite pending')).toBeVisible() // Sam Patel, West Loop
  await expect(page.getByText('Invite expired')).toBeVisible() // Jordan Blake, Porter
  await expect(page.getByText(/^\d+ restaurants · each color/)).toBeVisible()
  await testInfo.attach('restaurants', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('link', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('radio', { name: /picked automatically/ })).toBeVisible()
  await testInfo.attach('add-restaurant', { body: await page.screenshot(), contentType: 'image/png' })
})

test('a restaurant is added with a picked color and shows in the list', async ({ page }, testInfo) => {
  // Each browser project and each local run adds its own; the color picks itself.
  const name = `Test Kitchen ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants')
  await page.getByRole('link', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add restaurant' })).toBeVisible()

  const save = page.getByRole('button', { name: 'Save restaurant' })
  await expect(save).toBeDisabled()
  await page.getByLabel('Restaurant name').fill(name)
  await page.getByLabel('Address').fill('100 W Test St, Chicago')
  await page.getByLabel('Manager').selectOption({ label: 'Ari Kim' })
  await expect(page.getByText('They get access to this restaurant when you save.')).toBeVisible()
  await expect(page.getByRole('radio', { name: /picked automatically/ })).toHaveAttribute('aria-checked', 'true')
  await save.click()

  await expect(page).toHaveURL(/\/admin\/restaurants$/)
  await expect(page.getByRole('status').filter({ hasText: `${name} added.` })).toBeVisible()
  await expect(page.getByText(name, { exact: true })).toBeVisible()
})

test('a custom color too close to one in use will not save', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants/new')
  await page.getByLabel('Restaurant name').fill('Almost Federale’s')
  await page.getByLabel('Address').fill('1 Test St')
  await page.getByRole('radio', { name: 'Custom color' }).click()
  await page.getByLabel('Hex code').fill('#A8386F') // next to Federale's Logan Square
  await expect(page.getByText('Looks a lot like a color already in use.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save restaurant' })).toBeDisabled()
})

test('a manager cannot open the admin screens', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/admin/restaurants/new')
  await expect(page.getByRole('heading', { name: "You don't have access to the admin screens" })).toBeVisible()
})
