import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/** Reorder restaurants on the Ops dashboard. Saved on the device, so nothing here touches the seed. */

const labels = async (page: Page) =>
  (await page.getByRole('heading', { level: 2 }).allTextContents()).map((l) => l.split(' · ')[0])

async function openSheet(page: Page) {
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await page.getByRole('menuitem', { name: 'Reorder restaurants' }).click()
  return page.getByRole('dialog', { name: 'Reorder restaurants' })
}

test('dragging a handle changes the dashboard’s order, the picker’s, and it is remembered', async ({
  page,
  browserName,
}, testInfo) => {
  // WebKit's iPhone emulation sends no pointer events for a mouse drag; the keyboard test covers it.
  test.skip(browserName === 'webkit')
  await signIn(page, 'bert.velilla@example.com')
  await expect(page.getByRole('heading', { name: /^Porter · / })).toBeVisible()
  expect((await labels(page))[0]).toBe('Federale’s Logan Square')

  const sheet = await openSheet(page)
  const rows = sheet.getByRole('listitem')
  await expect(rows).toHaveCount(4)
  await page.waitForTimeout(300)
  await testInfo.attach('sheet', { body: await page.screenshot(), contentType: 'image/png' })

  const handle = (await sheet.getByRole('button', { name: 'Move Porter' }).boundingBox())!
  const top = (await rows.first().boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, top.y + 20, { steps: 12 })
  await page.mouse.move(handle.x + handle.width / 2, top.y + 10, { steps: 4 })
  await page.mouse.up()
  await expect(rows.first()).toContainText('Porter')
  // dnd-kit swallows clicks for a moment after a drop, so a stray tap doesn't land.
  await page.waitForTimeout(150)

  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(sheet).toHaveCount(0)
  expect((await labels(page))[0]).toBe('Porter')

  await page.reload()
  await expect(page.getByRole('heading', { name: /^Porter · / })).toBeVisible()
  expect((await labels(page))[0]).toBe('Porter')

  await page.getByRole('button', { name: /All restaurants \(\d+\)/ }).click()
  await expect(page.getByRole('menuitemradio').nth(1)).toContainText('Porter')
})

test('the keyboard can move a restaurant too', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await expect(page.getByRole('heading', { name: /^Porter · / })).toBeVisible()
  const sheet = await openSheet(page)
  const rows = sheet.getByRole('listitem')

  await sheet.getByRole('button', { name: 'Move Federale’s Logan Square' }).focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(300)
  await page.keyboard.press('Space')
  await expect(rows.nth(1)).toContainText('Federale’s Logan Square')
  await page.waitForTimeout(150)

  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(sheet).toHaveCount(0)
  expect((await labels(page)).slice(0, 2)).toEqual(['Federale’s West Loop', 'Federale’s Logan Square'])
  await page.reload()
  await expect(page.getByRole('heading', { name: /^Porter · / })).toBeVisible()
  expect((await labels(page))[0]).toBe('Federale’s West Loop')
})

test('a person’s order doesn’t reach anyone else on the device', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await expect(page.getByRole('heading', { name: /^Porter · / })).toBeVisible()
  await page.evaluate(() => {
    const id = '11111111-1111-4111-8111-000000000003'
    localStorage.setItem('ontrack.opsRestaurantOrder.someone-else', JSON.stringify([id]))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: /^Porter · / })).toBeVisible()
  expect((await labels(page))[0]).toBe('Federale’s Logan Square')
})

test('someone with one restaurant has nothing to reorder', async ({ page }) => {
  await page.route('**/rest/v1/restaurants*', async (route) => {
    const response = await route.fetch()
    const rows = (await response.json()) as unknown[]
    await route.fulfill({ response, json: rows.slice(0, 1) })
  })
  await signIn(page, 'bert.velilla@example.com')
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await expect(page.getByRole('menuitem', { name: 'View Closed Tickets' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Reorder restaurants' })).toHaveCount(0)
})
