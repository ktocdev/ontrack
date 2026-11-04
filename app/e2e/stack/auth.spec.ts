import { expect, test, type Page } from '@playwright/test'
import { SEED_PASSWORD, signIn } from './helpers'

test('a manager signs in and sees only their restaurant', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await expect(page).toHaveURL(/\/tickets$/)
  await expect(page.getByText('Federale’s Logan Square')).toBeVisible()
})

test('ops lands on the dashboard with every restaurant', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await expect(page).toHaveURL(/\/ops$/)
  // The count grows as other tests add restaurants to the shared database.
  await expect(page.getByText(/All restaurants \(\d+\)/)).toBeVisible()
})

const signInForm = async (page: Page) => {
  await page.getByLabel('Work email').fill('maya.reyes@example.com')
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('signing back in after signing out goes home, not to the page left', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.getByRole('link', { name: 'Your profile' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await signInForm(page)
  await expect(page).toHaveURL(/\/tickets$/)
})

test('a signed-out visitor to a page returns to it after signing in', async ({ page }) => {
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/sign-in/)
  await signInForm(page)
  await expect(page).toHaveURL(/\/profile$/)
})

test('a timed-out session returns to its page, also through Not you', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.getByRole('link', { name: 'Your profile' }).click()
  await expect(page).toHaveURL(/\/profile$/)

  // Past the 12-hour cap; the app checks when it loads.
  await page.evaluate(() => {
    const stamp = JSON.parse(localStorage.getItem('ontrack.signedIn')!) as { at: number }
    localStorage.setItem('ontrack.signedIn', JSON.stringify({ ...stamp, at: Date.now() - 13 * 60 * 60 * 1000 }))
  })
  await page.reload()
  const sheet = page.getByRole('dialog', { name: "You've been signed out" })
  await sheet.getByRole('button', { name: /^Not / }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await signInForm(page)
  await expect(page).toHaveURL(/\/profile$/)
})

test('a wrong password gets a plain message', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('Work email').fill('maya.reyes@example.com')
  await page.getByLabel('Password', { exact: true }).fill('not-the-password-2026')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText("That email and password don't match.", { exact: false })).toBeVisible()

  // It's about the last try, so it goes as soon as the person starts another.
  await page.getByLabel('Password', { exact: true }).fill('')
  await expect(page.getByText("That email and password don't match.", { exact: false })).toBeHidden()
})
