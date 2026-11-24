import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Leadership's tickets (OT-175): the Overview's Open tickets and Urgent open every
 * restaurant's open tickets in its own panel, with the Sort restaurants sheet, and the
 * counts match the Overview's. A restaurant's page has its name to itself and New ticket
 * under it. It only reads, and Sort is saved on the device.
 */

const LEE = 'lee.chen@example.com'

/** A figure on the Overview, as a number. */
async function figure(page: Page, label: string) {
  const link = page.getByRole('link', { name: new RegExp(`^\\d+\\s*${label}`) })
  await expect(link).toBeVisible()
  return Number((await link.innerText()).match(/\d+/)![0])
}

/** The restaurants' rows in order, as "Porter, 3 open, 1 urgent". */
const rows = (page: Page) =>
  page.locator('section > h2 > button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
const count = (label: string, what: 'open' | 'urgent') => Number(label.match(new RegExp(`, (\\d+) ${what}`))?.[1] ?? 0)

test('Open tickets and Urgent open the tickets behind them, in a panel per restaurant', async ({ page }, testInfo) => {
  await signIn(page, LEE)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  const open = await figure(page, 'Open tickets')
  const urgent = await figure(page, 'Urgent')

  await page
    .getByRole('link', { name: /Open tickets/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/lead\/tickets$/)
  await expect(page.getByRole('heading', { name: 'Open tickets', level: 1 })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Leadership' }).getByRole('link', { name: 'Overview' }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('radio', { name: `All open · ${open}` })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: /^Porter, \d+ open/ })).toBeVisible()
  const all = await rows(page)
  expect(all.reduce((n, l) => n + count(l, 'open'), 0)).toBe(open)
  // Every panel starts open, so every card shows.
  await expect(page.getByRole('link', { name: /OT-\d+/ })).toHaveCount(open)
  await testInfo.attach('open tickets', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('radio', { name: `Urgent · ${urgent}` }).click()
  await expect(page).toHaveURL(/\/lead\/tickets\?show=urgent$/)
  await expect(page.getByRole('heading', { name: 'Urgent tickets', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: /OT-\d+/ })).toHaveCount(urgent)
  for (const card of await page.getByRole('link', { name: /OT-\d+/ }).all()) await expect(card).toContainText('URGENT')

  // The Overview's Urgent comes straight here.
  await page.getByRole('link', { name: 'Back to Overview' }).click()
  await page
    .getByRole('link', { name: /Urgent/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/lead\/tickets\?show=urgent$/)

  // Sort restaurants is the dashboard's sheet.
  await page.getByRole('radio', { name: /^All open/ }).click()
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await page.getByRole('menuitem', { name: 'Sort restaurants' }).click()
  const sheet = page.getByRole('dialog', { name: 'Sort restaurants' })
  await sheet.getByRole('radio', { name: /Ticket count/ }).click()
  await expect(sheet.getByRole('radiogroup', { name: 'Show first' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Done' }).click()
  const counts = (await rows(page)).map((l) => count(l, 'open'))
  expect(counts).toEqual([...counts].sort((a, b) => b - a))

  // A panel closes on a tap, keeping its urgent tickets; a card opens the ticket.
  const porter = page.getByRole('button', { name: /^Porter, \d+ open/ })
  await porter.click()
  await expect(porter).toHaveAttribute('aria-expanded', 'false')
  await page
    .getByRole('link', { name: /OT-\d+/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/lead\/tickets\/[0-9a-f-]{36}$/)
})

test('a restaurant’s name has the width to itself, with New ticket under it', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, LEE)
  await page.goto('/lead/restaurants/11111111-1111-4111-8111-000000000001')
  const name = page.getByRole('button', { name: /Federale’s Logan Square/ }).first()
  await expect(name).toBeVisible()
  // One line at 22px, where it took three beside New ticket.
  expect((await name.boundingBox())!.height).toBeLessThan(48)
  const newTicket = page.getByRole('link', { name: 'New ticket' })
  expect((await newTicket.boundingBox())!.y).toBeGreaterThan((await name.boundingBox())!.y + 20)
  await testInfo.attach('restaurant', { body: await page.screenshot(), contentType: 'image/png' })
})
