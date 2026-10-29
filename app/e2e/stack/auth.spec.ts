import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

test('a manager signs in and sees only their restaurant', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await expect(page).toHaveURL(/\/tickets$/)
  await expect(page.getByText('Federale’s Logan Square')).toBeVisible()
})

test('ops lands on the dashboard with every restaurant', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await expect(page).toHaveURL(/\/ops$/)
  await expect(page.getByText(/All restaurants \(4\)/)).toBeVisible()
})

test('a wrong password gets a plain message', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('Work email').fill('maya.reyes@example.com')
  await page.getByLabel('Password').fill('not-the-password-2026')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText("That email and password don't match.", { exact: false })).toBeVisible()
})
