import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Swipe down to close a sheet (OT-76), on the kit's sheet. Playwright has no touch
 * drag, so the touches are dispatched by hand: a real finger is tried on Android and
 * an iPhone too.
 */

async function swipe(sheet: Locator, distance: number, { slow = false } = {}) {
  const box = (await sheet.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + 40
  const touch = (dy: number) => [{ identifier: 1, clientX: x, clientY: y + dy }]
  await sheet.dispatchEvent('touchstart', { touches: touch(0), changedTouches: touch(0) })
  for (let step = 1; step <= 5; step++) {
    await sheet.dispatchEvent('touchmove', {
      touches: touch((distance * step) / 5),
      changedTouches: touch((distance * step) / 5),
    })
    if (slow) await sheet.page().waitForTimeout(40)
  }
  if (slow) await sheet.page().waitForTimeout(150)
  await sheet.dispatchEvent('touchend', { touches: [], changedTouches: touch(distance) })
}

async function openSheet(page: Page) {
  await page.goto('/kit')
  await page.getByRole('button', { name: 'Open sheet' }).click()
  const sheet = page.getByRole('dialog', { name: 'Save 2 changes?' })
  await expect(sheet).toBeVisible()
  return sheet
}

test('a long swipe down closes the sheet', async ({ page }) => {
  const sheet = await openSheet(page)
  await swipe(sheet, 300, { slow: true })
  await expect(sheet).toHaveCount(0)
})

test('a quick flick closes it from a short way', async ({ page }) => {
  const sheet = await openSheet(page)
  await swipe(sheet, 60)
  await expect(sheet).toHaveCount(0)
})

test('a short, slow swipe springs back', async ({ page }) => {
  const sheet = await openSheet(page)
  await swipe(sheet, 50, { slow: true })
  await page.waitForTimeout(300)
  await expect(sheet).toBeVisible()
  await expect(sheet).toHaveCSS('transform', 'none')
})

test('a swipe up does nothing', async ({ page }) => {
  const sheet = await openSheet(page)
  await swipe(sheet, -200)
  await page.waitForTimeout(300)
  await expect(sheet).toBeVisible()
})

test('the signed-out sheet stays, however far it is swiped', async ({ page }) => {
  await page.goto('/kit')
  await page.getByRole('button', { name: 'Signed out sheet' }).click()
  const sheet = page.getByRole('dialog', { name: "You've been signed out" })
  await expect(sheet).toBeVisible()
  await swipe(sheet, 400, { slow: true })
  await page.waitForTimeout(300)
  await expect(sheet).toBeVisible()
  await expect(sheet).toHaveCSS('transform', 'none')
})
