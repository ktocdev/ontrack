import { expect, test, type Page } from '@playwright/test'

/**
 * Install the app (OT-72) against the e2e build: once after sign-in on a phone, then from
 * Profile. Chrome's install offer is an event no test browser fires, so the test fires a
 * stand-in and counts the calls to its prompt. A real install is tried on a phone.
 */

const offer = async (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { prompted: number }
    w.prompted = 0
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => {
        w.prompted += 1
        return Promise.resolve()
      },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    })
    window.dispatchEvent(event)
  })

// Start as a phone that has never been offered it.
test.use({ storageState: { cookies: [], origins: [] } })

async function signIn(page: Page) {
  await page.goto('/sign-in')
  await page.getByTestId('mock-manager').click()
  // Not the tab bar: on an iPhone the sheet may already cover it.
  await expect(page).toHaveURL(/\/tickets$/)
}

test.describe('on an Android phone', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chrome on a Pixel is the browser that offers an install')

  test('it is offered once after sign-in, and then from Profile', async ({ page }, testInfo) => {
    await signIn(page)
    await offer(page)
    const sheet = page.getByRole('dialog', { name: 'Install OnTrack' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('list', { name: 'How to install' })).toHaveCount(0)
    await page.waitForTimeout(300)
    await testInfo.attach('android', { body: await page.screenshot(), contentType: 'image/png' })
    await sheet.getByRole('button', { name: 'Not now' }).click()
    await expect(sheet).toHaveCount(0)

    // Not again on this phone, though the browser offers it again.
    await page.reload()
    await offer(page)
    await page.waitForTimeout(500)
    await expect(sheet).toHaveCount(0)

    await page.getByRole('link', { name: 'Your profile' }).click()
    await page.getByRole('button', { name: /Install the app/ }).click()
    await sheet.getByRole('button', { name: 'Install' }).click()
    await expect(sheet).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { prompted: number }).prompted)).toBe(1)
    // Chrome's offer is spent, so the row goes until the browser offers again.
    await expect(page.getByRole('button', { name: /Install the app/ })).toHaveCount(0)
  })
})

test.describe('on an iPhone', () => {
  test.skip(({ browserName }) => browserName !== 'webkit', 'WebKit stands in for Safari on an iPhone')

  test('it shows the two steps once after sign-in, and again from Profile', async ({ page }, testInfo) => {
    await signIn(page)
    const sheet = page.getByRole('dialog', { name: 'Install OnTrack' })
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('notifications only work from there')
    const steps = sheet.getByRole('list', { name: 'How to install' }).getByRole('listitem')
    await expect(steps).toHaveCount(2)
    await expect(steps.first()).toContainText('Share')
    await expect(steps.last()).toContainText('Add to Home Screen')
    await page.waitForTimeout(300)
    await testInfo.attach('iphone', { body: await page.screenshot(), contentType: 'image/png' })
    await sheet.getByRole('button', { name: 'Got it' }).click()
    await expect(sheet).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('navigation', { name: 'Manager' })).toBeVisible()
    await page.waitForTimeout(500)
    await expect(sheet).toHaveCount(0)
    await page.getByRole('link', { name: 'Your profile' }).click()
    await page.getByRole('button', { name: /Install the app/ }).click()
    await expect(sheet.getByRole('listitem')).toHaveCount(2)
  })
})

test('a phone whose browser offers no install is not asked, and Profile has no row', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Safari on an iPhone always has the two steps')
  await signIn(page)
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog', { name: 'Install OnTrack' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Your profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Install the app/ })).toHaveCount(0)
})
