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

test('a restaurant is added with a picked color, then deleted', async ({ page }, testInfo) => {
  // Each browser project and each local run adds its own and removes it again,
  // so the seven preset colors are never used up.
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

  // New and empty, so it can be deleted, manager and all.
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Delete restaurant' }).click()
  await page
    .getByRole('dialog', { name: `Delete ${name}?` })
    .getByRole('button', { name: 'Delete restaurant' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: `${name} deleted.` })).toBeVisible()
  await expect(page.getByText(name, { exact: true })).toBeHidden()
})

test('inviting a new manager goes on to Invite user with the restaurant picked', async ({ page }, testInfo) => {
  const name = `Invite Kitchen ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants/new')
  await page.getByLabel('Restaurant name').fill(name)
  await page.getByLabel('Address').fill('100 W Test St, Chicago')
  await page.getByLabel('Manager').selectOption({ label: '+ Invite a new manager' })
  await expect(page.getByText('you’ll go to Invite user with this restaurant already selected')).toBeVisible()
  await page.getByRole('button', { name: 'Save restaurant' }).click()

  await expect(page.getByRole('heading', { name: 'Invite a user' })).toBeVisible()
  await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')

  // Nobody was invited, so it is still empty and can go.
  await page.goto('/admin/restaurants')
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Delete restaurant' }).click()
  await page
    .getByRole('dialog', { name: `Delete ${name}?` })
    .getByRole('button', { name: 'Delete restaurant' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: `${name} deleted.` })).toBeVisible()
})

test('a custom color may look like one in use, but not match it', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants/new')
  await page.getByLabel('Restaurant name').fill('Almost Federale’s')
  await page.getByLabel('Address').fill('1 Test St')
  await page.getByRole('radio', { name: 'Custom color' }).click()
  const save = page.getByRole('button', { name: 'Save restaurant' })

  await page.getByLabel('Hex code').fill('#A8386F') // next to Federale's Logan Square
  await expect(save).toBeEnabled()

  await page.getByLabel('Hex code').fill('#A3336D') // Federale's Logan Square itself
  await expect(page.getByText('That color is already in use.')).toBeVisible()
  await expect(save).toBeDisabled()
})

test('a restaurant is edited, and only its own color stays free', async ({ page }, testInfo) => {
  const name = `Edit Kitchen ${testInfo.project.name} ${Date.now() % 100000}`
  const renamed = `${name} Two`
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants/new')
  await page.getByLabel('Restaurant name').fill(name)
  await page.getByLabel('Address').fill('100 W Test St, Chicago')
  await page.getByLabel('Phone').fill('(312) 555-0100')
  await page.getByRole('radio', { name: 'Custom color' }).click()
  const color = `#0${String(Date.now() % 100000).padStart(5, '0')}`
  await page.getByLabel('Hex code').fill(color)
  await page.getByRole('button', { name: 'Save restaurant' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} added.` })).toBeVisible()

  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.getByRole('dialog', { name }).getByRole('link', { name: 'Edit restaurant' }).click()
  await expect(page.getByRole('heading', { name: 'Edit restaurant' })).toBeVisible()

  // It opens as saved, with no manager to pick.
  await expect(page.getByLabel('Restaurant name')).toHaveValue(name)
  await expect(page.getByLabel('Address')).toHaveValue('100 W Test St, Chicago')
  await expect(page.getByLabel('Phone')).toHaveValue('(312) 555-0100')
  await expect(page.getByLabel('Hex code')).toHaveValue(color)
  await expect(page.getByLabel('Manager')).toHaveCount(0)
  await page.waitForTimeout(400)
  await testInfo.attach('edit-restaurant', { body: await page.screenshot(), contentType: 'image/png' })

  // A name another restaurant has is refused on the field, and the error clears on the next edit.
  await page.getByLabel('Restaurant name').fill('Porter')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('A restaurant with this name already exists.')).toBeVisible()

  await page.getByLabel('Restaurant name').fill(renamed)
  await expect(page.getByText('A restaurant with this name already exists.')).toBeHidden()
  await page.getByLabel('Phone').fill('')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/admin\/restaurants$/)
  await expect(page.getByRole('status').filter({ hasText: `${renamed} saved.` })).toBeVisible()
  await expect(page.getByText(renamed, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: new RegExp(`^${renamed}`) }).click()
  await page.getByRole('dialog', { name: renamed }).getByRole('button', { name: 'Delete restaurant' }).click()
  await page
    .getByRole('dialog', { name: `Delete ${renamed}?` })
    .getByRole('button', { name: 'Delete restaurant' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: `${renamed} deleted.` })).toBeVisible()
})

test('a manager cannot open the admin screens', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/admin/restaurants/new')
  await expect(page.getByRole('heading', { name: "You don't have access to the admin screens" })).toBeVisible()
})

test('a restaurant with history can be archived and restored, not deleted', async ({ page }, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants')
  await page.getByRole('button', { name: /^Porter/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Porter' })
  await expect(sheet.getByRole('button', { name: 'Delete restaurant' })).toBeDisabled()
  await expect(sheet.getByText('It has tickets, equipment or walkthroughs, so it can only be archived.')).toBeVisible()
  await page.waitForTimeout(400) // let the sheet finish sliding up
  await testInfo.attach('restaurant-sheet', { body: await page.screenshot(), contentType: 'image/png' })

  await sheet.getByRole('button', { name: 'Archive restaurant' }).click()
  const confirm = page.getByRole('dialog', { name: 'Archive Porter?' })
  await confirm.getByRole('button', { name: 'Archive restaurant' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Porter archived.' })).toBeVisible()
  await expect(page.getByText('Archived', { exact: true }).first()).toBeVisible()
  await page.waitForTimeout(400)
  await testInfo.attach('archived-section', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  // Put it back for the other tests.
  await page.getByRole('button', { name: /^Porter/ }).click()
  await page.getByRole('dialog', { name: 'Porter' }).getByRole('button', { name: 'Restore restaurant' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Porter restored.' })).toBeVisible()
})
