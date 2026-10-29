import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

test('a report from the 500 board is saved with its reference', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/kit/errors/500')
  await page.getByRole('button', { name: 'Report this problem' }).click()
  const sheet = page.getByRole('dialog', { name: 'Report a problem' })
  await expect(sheet).toContainText(/REF [0-9A-F]{4}-[0-9A-F]{4}/)
  await sheet.getByLabel('What happened?').fill('Playwright: the dashboard failed to load.')
  await sheet.getByRole('button', { name: 'Send to support' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Case #\d{4,}/ })).toBeVisible()
})
