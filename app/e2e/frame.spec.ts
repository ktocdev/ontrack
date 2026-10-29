import { expect, test, type Page } from '@playwright/test'

/**
 * The app frame: auth guard, role shells and tab bars, no-access and 404.
 * Runs against the e2e build (VITE_E2E_MOCK=1), which signs in from a role
 * picker instead of Supabase.
 */

async function signInAs(page: Page, role: 'manager' | 'ops' | 'admin' | 'leadership') {
  await page.goto('/sign-in')
  await page.getByTestId(`mock-${role}`).click()
}

test.describe('auth guard', () => {
  test('signed out: the root sends you to sign in and remembers where you were', async ({ page }) => {
    await page.goto('/ops/equipment')
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.getByTestId('mock-ops').click()
    await expect(page).toHaveURL(/\/ops\/equipment$/)
  })

  test('unknown paths show the 404 board', async ({ page }) => {
    await page.goto('/this/does/not/exist')
    await expect(page.getByText('Error 404')).toBeVisible()
    await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
  })
})

test.describe('role shells', () => {
  test('manager lands on Open tickets with the manager tab bar and restaurant name', async ({ page }) => {
    await signInAs(page, 'manager')
    await expect(page).toHaveURL(/\/tickets$/)
    await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
    await expect(page.getByText('Federale’s Logan Square')).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Manager' })
    await expect(nav.getByRole('link')).toHaveText(['Create ticket', 'Open tickets', 'Walkthrough', 'Equipment'])
    await expect(nav.getByRole('link', { name: 'Open tickets' })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('link', { name: 'Equipment' }).click()
    await expect(page.getByRole('heading', { name: 'Equipment' })).toBeVisible()
  })

  test('ops lands on the Dashboard with the operations tab bar', async ({ page }) => {
    await signInAs(page, 'ops')
    await expect(page).toHaveURL(/\/ops$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('All restaurants (4)')).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Operations' })
    await expect(nav.getByRole('link')).toHaveText(['Dashboard', 'Walkthroughs', 'Equipment', 'Contractors'])
  })

  test('admin lands on Users with the admin tab bar', async ({ page }) => {
    await signInAs(page, 'admin')
    await expect(page).toHaveURL(/\/admin\/users$/)
    const nav = page.getByRole('navigation', { name: 'Admin' })
    await expect(nav.getByRole('link')).toHaveText(['Users', 'Roles & rights', 'Tickets', 'Restaurants'])
  })

  test('leadership lands on Overview with the read-only banner', async ({ page }) => {
    await signInAs(page, 'leadership')
    await expect(page).toHaveURL(/\/lead$/)
    await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Leadership' })
    await expect(nav.getByRole('link')).toHaveText(['Overview', 'Restaurants', 'Walkthroughs', 'Contractors'])
  })

  test('a manager opening an ops route sees the no-access board, not the screen', async ({ page }) => {
    await signInAs(page, 'manager')
    await page.goto('/ops')
    await expect(page.getByText('Error 403')).toBeVisible()
    await expect(page.getByRole('heading', { name: /don't have access/ })).toBeVisible()
    await page.getByRole('button', { name: 'Ask admin for access' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'We let your admin know' })).toBeVisible()
    await page.getByRole('link', { name: 'Go to my tickets' }).click()
    await expect(page).toHaveURL(/\/tickets$/)
  })

  test('the tab bar sits above the home-bar inset and keeps 44px targets', async ({ page }) => {
    await signInAs(page, 'ops')
    const link = page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: 'Equipment' })
    const box = (await link.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    // The home-bar inset replaces the design's 20px; with no inset it is 8px.
    const pad = await page
      .getByRole('navigation', { name: 'Operations' })
      .evaluate((el) => getComputedStyle(el).paddingBottom)
    expect(pad).toBe('8px')
  })
})

test.describe('error screens', () => {
  test('500 board offers retry and a copyable reference', async ({ page }) => {
    await page.goto('/kit/errors/500')
    await expect(page.getByRole('alert')).toContainText('Something went wrong on our end')
    await expect(page.getByText(/REF [0-9A-F]{4}-[0-9A-F]{4}/)).toBeVisible()
    await page.getByRole('button', { name: 'Report this problem' }).click()
    await expect(page.getByRole('dialog', { name: 'Report a problem' })).toBeVisible()
    await page.getByRole('button', { name: 'Send to support' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Sent to support' })).toBeVisible()
  })
})
