import { expect, test } from '@playwright/test'
import { openProfile, signIn, tokenFor } from './helpers'

/**
 * Group settings on Roles & rights. These change something everyone sees, so each
 * test puts it back before it ends, whatever happens. Tests run one at a time.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

test('an admin renames the group, and the header follows', async ({ page }, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/roles')
  await page.getByRole('button', { name: 'Edit group name' }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit group name' })
  await expect(sheet.getByLabel('Name', { exact: true })).toHaveValue('Four Corners')
  await page.waitForTimeout(400) // let the sheet finish sliding up
  await testInfo.attach('group-name-sheet', { body: await page.screenshot(), contentType: 'image/png' })

  const save = sheet.getByRole('button', { name: 'Save name' })
  await sheet.getByLabel('Name', { exact: true }).fill('   ')
  await expect(save).toBeDisabled()
  try {
    await sheet.getByLabel('Name', { exact: true }).fill('Hog Salt')
    await sheet.getByLabel(/Short name/).fill('HS')
    await save.click()
    await expect(page.getByRole('status').filter({ hasText: 'Group name saved.' })).toBeVisible()
    await expect(page.getByText('HS | Hog Salt').first()).toBeVisible()
  } finally {
    await page.getByRole('button', { name: 'Edit group name' }).click()
    const back = page.getByRole('dialog', { name: 'Edit group name' })
    await back.getByLabel('Name', { exact: true }).fill('Four Corners')
    await back.getByLabel(/Short name/).fill('4C')
    await back.getByRole('button', { name: 'Save name' }).click()
    await expect(page.getByText('4C | Four Corners').first()).toBeVisible()
  }
})

test('profile photos off hides them and refuses new ones, and on brings them back', async ({
  browser,
  page,
  request,
}, testInfo) => {
  // Bert has a photo. The admin works in a separate browser.
  const bertId = '22222222-2222-4222-8222-000000000003'
  await openProfile(page, 'bert.velilla@example.com')
  await page.locator('input[type="file"]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
  const photo = page.getByRole('img', { name: 'Your profile photo' }).locator('img')
  await expect(photo).toBeVisible()

  const context = await browser.newContext({ ...testInfo.project.use, serviceWorkers: 'block' })
  const admin = await context.newPage()
  await signIn(admin, 'admin@example.com')
  await admin.goto('/admin/roles')
  const toggle = admin.getByRole('switch', { name: 'Profile photos' })
  await expect(toggle).toBeChecked()
  await toggle.scrollIntoViewIfNeeded()
  await testInfo.attach('group-settings', { body: await admin.screenshot(), contentType: 'image/png' })

  // Nothing changes until the sheet is confirmed.
  await toggle.click()
  await admin.getByRole('button', { name: 'Cancel' }).click()
  await expect(toggle).toBeChecked()

  await toggle.click()
  await admin.waitForTimeout(400) // let the sheet finish sliding up
  await testInfo.attach('photos-off-sheet', { body: await admin.screenshot(), contentType: 'image/png' })
  await admin.getByRole('button', { name: 'Turn off photos' }).click()
  await expect(admin.getByRole('status').filter({ hasText: 'Profile photos turned off.' })).toBeVisible()
  await expect(toggle).not.toBeChecked()

  try {
    // The admin's own list shows initials straight away.
    await admin.goto(`/admin/users/${bertId}`)
    await expect(admin.getByRole('heading', { name: 'Bert Velilla' })).toBeVisible()
    await expect(admin.locator('img')).toHaveCount(0)

    // Bert: initials, no way to add one, and still a way to remove it.
    await page.reload()
    await expect(page.getByText('Profile photos are turned off for your group.')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Your profile photo' })).toHaveCount(0)
    await expect(page.locator('img')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /photo/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible()
    await testInfo.attach('profile-photos-off', { body: await page.screenshot(), contentType: 'image/png' })

    // And through the API, where hiding a button means nothing.
    const token = await tokenFor(request, 'bert.velilla@example.com')
    const upload = await request.post(`${SUPABASE}/storage/v1/object/avatars/${bertId}/sneaky.png`, {
      headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      data: PNG,
    })
    expect(upload.ok()).toBe(false)
    const point = await request.patch(`${SUPABASE}/rest/v1/profiles?id=eq.${bertId}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { avatar_path: `${bertId}/sneaky.png` },
    })
    expect(point.ok()).toBe(false)
  } finally {
    await admin.goto('/admin/roles')
    await admin.getByRole('switch', { name: 'Profile photos' }).click()
    await admin.getByRole('button', { name: 'Turn on photos' }).click()
    await expect(admin.getByRole('switch', { name: 'Profile photos' })).toBeChecked()
    await context.close()
  }

  // On again: the same photo is back, untouched, and Bert puts things as they were.
  await page.reload()
  await expect(photo).toBeVisible()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('button', { name: 'Upload photo' })).toBeVisible()
})

test('someone can remove their own photo while they are off', async ({ browser, page, request }, testInfo) => {
  await openProfile(page, 'bert.velilla@example.com')
  await page.locator('input[type="file"]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: 'Your profile photo' }).locator('img')).toBeVisible()

  const context = await browser.newContext({ ...testInfo.project.use, serviceWorkers: 'block' })
  const admin = await context.newPage()
  await signIn(admin, 'admin@example.com')
  await admin.goto('/admin/roles')
  await admin.getByRole('switch', { name: 'Profile photos' }).click()
  await admin.getByRole('button', { name: 'Turn off photos' }).click()
  await expect(admin.getByRole('switch', { name: 'Profile photos' })).not.toBeChecked()

  try {
    await page.reload()
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0)
  } finally {
    await admin.getByRole('switch', { name: 'Profile photos' }).click()
    await admin.getByRole('button', { name: 'Turn on photos' }).click()
    await expect(admin.getByRole('switch', { name: 'Profile photos' })).toBeChecked()
    await context.close()
  }

  // It really went: Upload is offered again, and the file is gone from Storage.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Upload photo' })).toBeVisible()
  const token = await tokenFor(request, 'bert.velilla@example.com')
  const files = await request.post(`${SUPABASE}/storage/v1/object/list/avatars`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    data: { prefix: '22222222-2222-4222-8222-000000000003' },
  })
  expect(await files.json()).toEqual([])
})
