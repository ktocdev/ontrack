import { expect, test } from '@playwright/test'
import { openProfile, SEED_PASSWORD } from './helpers'

// 1×1 PNG, enough for createImageBitmap and the upload path.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test('a name change saves and survives a reload', async ({ page }) => {
  await openProfile(page, 'ari.kim@example.com')
  await page.getByLabel('Name').fill('Ari K. Kim')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Name')).toHaveValue('Ari K. Kim')

  // Put the seed back for the next project and the next run.
  await page.getByLabel('Name').fill('Ari Kim')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible()
})

test('a photo uploads, shows, and can be removed', async ({ page }) => {
  await openProfile(page, 'lee.chen@example.com')
  await page.locator('input[type="file"]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: 'Your profile photo' }).locator('img')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Profile photo saved.' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Profile photo removed.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload photo' })).toBeVisible()
})

test('a report is saved and gets a case number', async ({ page }) => {
  await openProfile(page, 'maya.reyes@example.com')
  await page.getByRole('button', { name: /Report a problem/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Report a problem' })
  await sheet.getByLabel('What happened?').fill('Playwright: the camera will not open.')
  await sheet.getByRole('button', { name: 'Send to support' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Case #\d{4,}/ })).toBeVisible()
})

test('a password change works and is changed back', async ({ page }) => {
  const email = 'chris.novak@example.com'
  const temp = 'temporary-password-2026'
  const change = async (from: string, to: string) => {
    await page.getByRole('button', { name: 'Change', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Change password' })
    await sheet.getByLabel('Current password').fill(from)
    await sheet.getByLabel('New password', { exact: true }).fill(to)
    await sheet.getByLabel('Confirm new password').fill(to)
    await sheet.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Password updated' })).toBeVisible()
  }

  await openProfile(page, email)
  await change(SEED_PASSWORD, temp)

  // The new password signs in; then put the seed's back.
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password').fill(temp)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Signing back in returns to where they signed out from.
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await change(temp, SEED_PASSWORD)
})
