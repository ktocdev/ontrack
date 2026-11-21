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

  test('a sheet is a centered dialog that Escape closes', async ({ page }) => {
    await page.goto('/kit')
    await page.getByRole('button', { name: 'Open sheet' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expect((await dialog.boundingBox())!.width).toBe(440)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

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
    await expect(page.getByRole('heading', { name: 'Equipment', exact: true })).toBeVisible()
  })

  test('one-column screens sit in a 720 px reading column beside the sidebar', async ({ page }) => {
    await signInAs(page, 'manager')
    await page.getByRole('link', { name: 'Your profile' }).click()
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    const column = (await page.locator('[data-screen="reading"]').boundingBox())!
    expect(column.width).toBe(720)
    // Centered in the 1192 px beside the 248 px sidebar.
    expect(column.x).toBe(248 + (1440 - 248 - 720) / 2)
  })

  test('the 404 board has no tab bar', async ({ page }) => {
    await signInAs(page, 'ops')
    await page.goto('/this/does/not/exist')
    await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
    await expect(page.getByTestId('tab-bar')).toBeHidden()
  })

  test('the first Tab offers Skip to content, past the sidebar', async ({ page }) => {
    await signInAs(page, 'ops')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    const skip = page.getByRole('button', { name: 'Skip to content' })
    // A fresh page, so Tab starts from the top.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.locator('#content')).toBeFocused()
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
