import { expect, test, type Page } from '@playwright/test'

/**
 * Profile and Help & support (OT-6) against the e2e build: layout, the form
 * rules and everything that needs no backend. Saving, password change, photos
 * and reports run against the seeded local stack in e2e/stack/profile.spec.ts.
 */

async function openProfile(page: Page) {
  await page.goto('/sign-in')
  await page.getByTestId('mock-manager').click()
  await page.getByRole('link', { name: 'Your profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
}

test('profile shows the account and guards the name', async ({ page }) => {
  await openProfile(page)
  await expect(page.getByText('maya.reyes@example.com')).toBeVisible()
  await expect(page.getByText("Federale's Logan Square").or(page.getByText('Federale’s Logan Square'))).toBeVisible()

  const save = page.getByRole('button', { name: 'Save changes' })
  await expect(save).toBeDisabled()
  await page.getByLabel('Name').fill('')
  await expect(page.getByText('Enter your name.')).toBeVisible()
  await expect(save).toBeDisabled()
  await page.getByLabel('Name').fill('Maya R. Reyes')
  await expect(save).toBeEnabled()
})

test('theme can be changed from the profile', async ({ page }) => {
  await openProfile(page)
  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('change password checks length and the confirmation', async ({ page }) => {
  await openProfile(page)
  await page.getByRole('button', { name: 'Change', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Change password' })
  await sheet.getByLabel('Current password').fill('ontrack-demo-2026')
  await sheet.getByLabel('New password', { exact: true }).fill('short')
  await sheet.getByLabel('Confirm new password').fill('different')
  await expect(sheet.getByText("Doesn't match the new password.")).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Update password' })).toBeDisabled()

  await sheet.getByLabel('New password', { exact: true }).fill('a-much-longer-password')
  await sheet.getByLabel('Confirm new password').fill('a-much-longer-password')
  await expect(sheet.getByRole('button', { name: 'Update password' })).toBeEnabled()
  await sheet.getByLabel('New password', { exact: true }).fill('ontrack-demo-2026')
  await sheet.getByLabel('Confirm new password').fill('ontrack-demo-2026')
  await expect(sheet.getByText('Use a different password from your current one.')).toBeVisible()
})

test('report a problem needs a description', async ({ page }) => {
  await openProfile(page)
  await page.getByRole('button', { name: /Report a problem/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Report a problem' })
  await expect(sheet.getByRole('button', { name: 'Send to support' })).toBeDisabled()
  await sheet.getByLabel('What happened?').fill('The camera will not open.')
  await expect(sheet.getByRole('button', { name: 'Send to support' })).toBeEnabled()
})

test('help searches the questions and opens one answer at a time', async ({ page }) => {
  await openProfile(page)
  await page.getByRole('link', { name: /Help center/ }).click()
  await expect(page.getByRole('heading', { name: 'Help & support' })).toBeVisible()

  const first = page.getByRole('button', { name: 'How do I report broken equipment?' })
  await expect(first).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Who sees my tickets?' }).click()
  await expect(first).toHaveAttribute('aria-expanded', 'false')

  await page.getByLabel('Search help').fill('QR')
  await expect(page.getByRole('button', { name: /QR label/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Who sees my tickets?' })).toBeHidden()
  await page.getByLabel('Search help').fill('zzz')
  await expect(page.getByText(/No questions match/)).toBeVisible()

  await page.getByRole('link', { name: 'Back to profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
})

test('sign out returns to sign in', async ({ page }) => {
  await openProfile(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in/)
})

test('the signed-out sheet stays until an action closes it', async ({ page }) => {
  await page.goto('/kit')
  await page.getByRole('button', { name: 'Signed out sheet' }).click()
  const sheet = page.getByRole('dialog', { name: "You've been signed out" })
  await expect(sheet.getByLabel('Work email')).toHaveValue('maya.reyes@example.com')
  await page.keyboard.press('Escape')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Sign in and continue' })).toBeDisabled()
  await sheet.getByRole('button', { name: 'Not Maya?' }).click()
  await expect(sheet).toBeHidden()
})
