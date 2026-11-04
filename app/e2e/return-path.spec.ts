import { expect, test } from '@playwright/test'

/**
 * Sign-in returns to the page that was asked for, and only to a page of this app. A link
 * like https://app//evil.com/x reaches the router as the path "//evil.com/x", which a
 * browser reads as another site, so it must not become the return path (OT-55).
 */
for (const path of ['//evil.com/x', '/\\evil.com/x', '//evil.com', '/%2F%2Fevil.com/x']) {
  test(`sign-in never returns to another site via ${path}`, async ({ page }) => {
    const left: string[] = []
    await page.route(/^https?:\/\/evil\.com\//, (route) => {
      left.push(route.request().url())
      return route.fulfill({ status: 200, body: 'left the app' })
    })
    // Absolute, since Playwright would otherwise read //evil.com against the base URL itself.
    await page.goto(`${test.info().project.use.baseURL}${path}`)
    // Today such a path lands on the 404 board without passing sign-in; if a guarded route
    // ever matched it, sign-in must still come back to this app.
    const picker = page.getByTestId('mock-roles')
    await expect(picker.or(page.getByRole('heading', { name: "We can't find that page" }))).toBeVisible()
    if (await picker.isVisible()) {
      await page.getByTestId('mock-manager').click()
      await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
    }
    expect(new URL(page.url()).hostname).toBe('localhost')
    expect(left).toEqual([])
  })
}

test('sign-in returns to the page that was asked for', async ({ page }) => {
  await page.goto('/profile?tab=help')
  await expect(page.getByTestId('mock-roles')).toBeVisible()
  await page.getByTestId('mock-manager').click()
  await expect(page).toHaveURL(/\/profile\?tab=help$/)
})
