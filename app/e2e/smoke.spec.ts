import { expect, test } from '@playwright/test'

test.describe('foundation', () => {
  test('loads with the manifest and icons wired', async ({ page }) => {
    await page.goto('/kit')
    await expect(page).toHaveTitle('OnTrack')
    await expect(page.getByTestId('kit')).toBeVisible()
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
    await page.goto('/kit')
    const html = page.locator('html')

    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(18, 23, 22)')

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByTestId('kit-theme')).toHaveText('dark')

    await page.getByRole('radio', { name: 'Light' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(243, 244, 241)')
  })

  test('system preference is honored when no choice is saved', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/kit')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('text fields never render below 16px (iOS zoom guard)', async ({ page }) => {
    await page.goto('/kit')
    await expect(page.getByTestId('kit')).toBeVisible()
    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input, select, textarea')).map((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      ),
    )
    expect(sizes.length).toBeGreaterThan(3)
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16)
  })

  test('kit controls meet the 44px tap target', async ({ page }) => {
    await page.goto('/kit')
    await expect(page.getByTestId('kit')).toBeVisible()
    const primary = page.getByRole('button', { name: 'Primary · 52' })
    const secondary = page.getByRole('button', { name: 'Secondary · 48' })
    expect((await primary.boundingBox())!.height).toBeGreaterThanOrEqual(52)
    expect((await secondary.boundingBox())!.height).toBeGreaterThanOrEqual(48)
    const back = page.getByRole('button', { name: 'Back' })
    const box = (await back.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  })

  test('every status pill renders', async ({ page }) => {
    await page.goto('/kit')
    const pills = page.getByTestId('pills').locator('span')
    await expect(pills.filter({ hasText: 'Open' }).first()).toBeVisible()
    await expect(pills.filter({ hasText: 'Waiting on parts' })).toBeVisible()
    await expect(pills.filter({ hasText: 'Reopened' })).toBeVisible()
    await expect(pills.filter({ hasText: 'Fixed' })).toBeVisible()
  })
})
