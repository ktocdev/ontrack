import { expect, test, type Page } from '@playwright/test'

/** The kit scrolls inside ScreenBody only; the document itself never scrolls. */
async function documentOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
}

test.describe('kit on a phone', () => {
  test('has one scrollbar: the page never grows past the viewport', async ({ page }) => {
    await page.goto('/kit')
    await expect(page.getByTestId('kit')).toBeVisible()
    expect(await documentOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('primary button darkens while pressed', async ({ page }) => {
    await page.goto('/kit')
    const button = page.getByRole('button', { name: 'Primary · 52' })
    const bg = () => button.evaluate((el) => getComputedStyle(el).backgroundColor)
    await button.scrollIntoViewIfNeeded()
    const box = (await button.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2)
    const before = await bg()
    await page.mouse.down()
    await expect.poll(bg).not.toBe(before)
    await page.mouse.up()
  })

  test('sidebar is hidden', async ({ page }) => {
    await page.goto('/kit')
    await expect(page.getByRole('navigation', { name: 'Kit sections' })).toBeHidden()
  })
})

test.describe('kit on a laptop', () => {
  test.use({ viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false })

  test('shows the sidebar, caps at 1440 and keeps one scrollbar', async ({ page }) => {
    await page.goto('/kit')
    const nav = page.getByRole('navigation', { name: 'Kit sections' })
    await expect(nav).toBeVisible()
    const row = page.getByTestId('kit').locator('..')
    expect((await row.boundingBox())!.width).toBe(1440)
    expect(await documentOverflow(page)).toBeLessThanOrEqual(0)

    await nav.getByRole('link', { name: 'Fields' }).click()
    await expect(page.locator('#fields')).toBeInViewport()
  })

  test('the sheet opens as a centered dialog', async ({ page }) => {
    await page.goto('/kit')
    await page.getByRole('button', { name: 'Open sheet' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const box = (await dialog.boundingBox())!
    expect(box.width).toBe(440)
    expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThan(30)
  })
})

test.describe('accent picker', () => {
  test('a custom color asks for a full hex code', async ({ page }) => {
    await page.goto('/kit')
    const group = page.getByRole('radiogroup', { name: 'Accent color' })
    await expect(group.getByRole('radio', { name: 'Ocean' })).toHaveAttribute('aria-checked', 'true')
    await group.getByRole('radio', { name: 'Custom color' }).click()
    const hex = page.getByLabel('Hex code')
    await hex.fill('#C21')
    await expect(page.getByRole('status').filter({ hasText: 'Enter a 6-digit hex code' })).toBeVisible()
    await hex.fill('C2185B')
    await expect(page.getByRole('status').filter({ hasText: 'Enter a 6-digit hex code' })).toBeHidden()
  })
})
