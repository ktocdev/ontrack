import { expect, test } from '@playwright/test'

test.describe('foundation', () => {
  test('loads the shell with the manifest and icons wired', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('OnTrack')
    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest/)
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png')

    const manifest = await page.request.get('/manifest.webmanifest')
    expect(manifest.ok()).toBeTruthy()
    const json = await manifest.json()
    expect(json.name).toBe('OnTrack')
    expect(json.display).toBe('standalone')
    expect(json.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBeTruthy()
  })

  test('theme toggle switches tokens and persists across reload', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')

    await page.getByTestId('theme-dark').click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(darkBg).toBe('rgb(18, 23, 22)') // --bg dark #121716

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')

    await page.getByTestId('theme-light').click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(lightBg).toBe('rgb(243, 244, 241)') // --bg light #F3F4F1
  })

  test('system preference is honored when no choice is saved', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('text fields never render below 16px (iOS zoom guard)', async ({ page }) => {
    await page.goto('/')
    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input, select, textarea')).map((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      ),
    )
    // Vacuous until the first form lands; it starts failing the moment a field drops below 16px.
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16)
  })
})
