import { expect, test, type Page } from '@playwright/test'

/**
 * The desktop frame (OT-157): from 768 px the sidebar takes the tab bar's place, on detail
 * screens too, and the row stops growing at 1440 px. A phone at 390 px is unchanged.
 * Runs against the e2e build (VITE_E2E_MOCK=1).
 */

async function signInAs(page: Page, role: 'manager' | 'ops' | 'admin' | 'leadership') {
  await page.goto('/sign-in')
  await page.getByTestId(`mock-${role}`).click()
}

const tabBar = (page: Page) => page.getByTestId('tab-bar')
const sidebar = (page: Page) => page.locator('aside')

test.describe('a phone at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('has the tab bar and the header avatar, no sidebar', async ({ page }) => {
    await signInAs(page, 'ops')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(tabBar(page)).toBeVisible()
    await expect(sidebar(page)).toBeHidden()
    await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible()
  })
})

test.describe('a tablet at 768 px', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('has the sidebar in place of the tab bar', async ({ page }) => {
    await signInAs(page, 'manager')
    await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
    await expect(sidebar(page)).toBeVisible()
    await expect(tabBar(page)).toBeHidden()
    const nav = page.getByRole('navigation', { name: 'Manager' })
    await expect(nav.getByRole('link')).toHaveText(['Create ticket', 'Open tickets', 'Walkthrough', 'Equipment'])
    await expect(nav.getByRole('link', { name: 'Open tickets' })).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('a laptop at 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the sidebar has the role’s tabs, the group and who is signed in', async ({ page }) => {
    await signInAs(page, 'ops')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    const aside = sidebar(page)
    await expect(aside).toBeVisible()
    await expect(aside.getByText('4C | Four Corners')).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Operations' })
    await expect(nav.getByRole('link')).toHaveText(['Dashboard', 'Walkthroughs', 'Equipment', 'Contractors'])
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    await expect(tabBar(page)).toBeHidden()
    // One way to Profile: the sidebar's foot, not the header's avatar too.
    await expect(page.getByRole('link', { name: 'Your profile' })).toHaveCount(1)
    await expect(aside.getByRole('link', { name: 'Your profile' })).toBeVisible()

    await nav.getByRole('link', { name: 'Equipment' }).click()
    await expect(page).toHaveURL(/\/ops\/equipment$/)
    await expect(nav.getByRole('link', { name: 'Equipment' })).toHaveAttribute('aria-current', 'page')
  })

  test('a detail screen keeps the sidebar, and the way home', async ({ page }) => {
    await signInAs(page, 'manager')
    await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
    await sidebar(page).getByRole('link', { name: 'Your profile' }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(sidebar(page)).toBeVisible()
    await page.getByRole('navigation', { name: 'Manager' }).getByRole('link', { name: 'Equipment' }).click()
    await expect(page.getByRole('heading', { name: 'Equipment' })).toBeVisible()
  })

  test('the row stops at 1440 px and centers on a wider screen', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await signInAs(page, 'leadership')
    await expect(sidebar(page)).toBeVisible()
    const box = (await sidebar(page).boundingBox())!
    expect(box.x).toBe(240)
    expect(box.width).toBe(248)
  })
})
