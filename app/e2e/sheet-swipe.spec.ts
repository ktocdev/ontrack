import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Swipe down to close a sheet (OT-76), on the kit's sheet. Playwright has no touch
 * drag, so the touches are made by hand: a real finger is tried on Android and an
 * iPhone too. The whole gesture runs inside the page with its own timing, since
 * sending each touch from the test took longer than a flick on a slow CI runner.
 */

async function swipe(sheet: Locator, distance: number, { slow = false } = {}) {
  const box = (await sheet.boundingBox())!
  await sheet.evaluate(
    async (el, { x, y, distance, slow }) => {
      const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))
      // WebKit can't construct a Touch, so a plain event carries what the sheet reads.
      const fire = (type: string, dy: number | null) => {
        const touch = { identifier: 1, target: el, clientX: x, clientY: y + (dy ?? distance) }
        const event = new Event(type, { bubbles: true, cancelable: true })
        Object.defineProperties(event, {
          touches: { value: dy === null ? [] : [touch] },
          changedTouches: { value: [touch] },
        })
        el.dispatchEvent(event)
      }
      fire('touchstart', 0)
      for (let step = 1; step <= 5; step++) {
        await wait(slow ? 40 : 4)
        fire('touchmove', (distance * step) / 5)
      }
      if (slow) await wait(150)
      fire('touchend', null)
    },
    { x: box.x + box.width / 2, y: box.y + 40, distance, slow },
  )
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
