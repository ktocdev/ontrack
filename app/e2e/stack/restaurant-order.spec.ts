import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Sort restaurants on the Ops dashboard (OT-173): Most urgent, Ticket count, or Custom
 * order, which drags the person's own order (it replaced Reorder restaurants). Saved on
 * the device, so nothing here touches the seed.
 */

const BERT_ID = '22222222-2222-4222-8222-000000000003'

/** The restaurants' rows on the dashboard, in order, as their labels ("Porter, 3 open, 1 urgent"). */
const rowLabels = (page: Page) =>
  page.locator('section > h2 > button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
const labels = async (page: Page) => (await rowLabels(page)).map((l) => l.split(', ')[0])
const count = (label: string, what: 'open' | 'urgent') => Number(label.match(new RegExp(`, (\\d+) ${what}`))?.[1] ?? 0)

async function dashboard(page: Page) {
  await expect(page.getByRole('button', { name: /^Porter, \d+ open/ })).toBeVisible()
}

async function openSheet(page: Page) {
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await page.getByRole('menuitem', { name: 'Sort restaurants' }).click()
  return page.getByRole('dialog', { name: 'Sort restaurants' })
}

test('Most urgent to begin with, and Ticket count is remembered', async ({ page }, testInfo) => {
  await signIn(page, 'bert.velilla@example.com')
  await dashboard(page)
  const sheet = await openSheet(page)
  await expect(sheet.getByRole('radio', { name: /Most urgent/ })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet.getByRole('list', { name: 'Your order' })).toHaveCount(0)
  await expect(sheet.getByText('Saved on this device.')).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('most urgent', { body: await page.screenshot(), contentType: 'image/png' })

  await sheet.getByRole('radio', { name: /Ticket count/ }).click()
  await expect(sheet.getByRole('radio', { name: /Ticket count/ })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(sheet).toHaveCount(0)
  const open = (await rowLabels(page)).map((l) => count(l, 'open'))
  expect(open).toEqual([...open].sort((a, b) => b - a))

  await page.reload()
  await dashboard(page)
  await expect((await openSheet(page)).getByRole('radio', { name: /Ticket count/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('dragging a handle in Custom order changes the dashboard’s order, the picker’s, and it is remembered', async ({
  page,
  browserName,
}, testInfo) => {
  // WebKit's iPhone emulation sends no pointer events for a mouse drag; the keyboard test covers it.
  test.skip(browserName === 'webkit')
  await signIn(page, 'bert.velilla@example.com')
  await dashboard(page)

  const sheet = await openSheet(page)
  await sheet.getByRole('radio', { name: /Custom order/ }).click()
  const rows = sheet.getByRole('listitem')
  await expect(rows).toHaveCount(4)
  await expect(rows.first()).toContainText('Federale’s Logan Square')
  await page.waitForTimeout(300)
  await testInfo.attach('custom order', { body: await page.screenshot(), contentType: 'image/png' })

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
  await dashboard(page)
  expect((await labels(page))[0]).toBe('Porter')

  await page.getByRole('button', { name: /All restaurants \(\d+\)/ }).click()
  await expect(page.getByRole('menuitemradio').nth(1)).toContainText('Porter')
})

test('the keyboard can move a restaurant too', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await dashboard(page)
  const sheet = await openSheet(page)
  await sheet.getByRole('radio', { name: /Custom order/ }).click()
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
  await dashboard(page)
  expect((await labels(page))[0]).toBe('Federale’s West Loop')
})

test('an order dragged before Sort restaurants existed starts on Custom order', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await dashboard(page)
  const one = '11111111-1111-4111-8111-000000000003'
  await page.evaluate(
    ([id, key]) => localStorage.setItem(key, JSON.stringify([id])),
    [one, `ontrack.opsRestaurantOrder.${BERT_ID}`],
  )
  await page.reload()
  await dashboard(page)
  const first = (await labels(page))[0]
  const sheet = await openSheet(page)
  await expect(sheet.getByRole('radio', { name: /Custom order/ })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet.getByRole('listitem').first()).toContainText(first!)
})

test('a person’s sort and order don’t reach anyone else on the device', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await dashboard(page)
  await page.evaluate(() => {
    localStorage.setItem('ontrack.opsRestaurantOrder.someone-else', JSON.stringify(['x']))
    localStorage.setItem('ontrack.restaurantSort.someone-else', 'count')
  })
  await page.reload()
  await dashboard(page)
  const sheet = await openSheet(page)
  await expect(sheet.getByRole('radio', { name: /Most urgent/ })).toHaveAttribute('aria-checked', 'true')
})

test('someone with one restaurant has nothing to sort', async ({ page }) => {
  await page.route('**/rest/v1/restaurants*', async (route) => {
    const response = await route.fetch()
    const rows = (await response.json()) as unknown[]
    await route.fulfill({ response, json: rows.slice(0, 1) })
  })
  await signIn(page, 'bert.velilla@example.com')
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await expect(page.getByRole('menuitem', { name: 'View Closed Tickets' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Sort restaurants' })).toHaveCount(0)
})
