import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * List and detail on a laptop (OT-159): from 1024 px a ticket opens beside its list, which
 * keeps its place; the address is the ticket's own, so a reload keeps both. A phone shows
 * one or the other, as before.
 */

test.use({ viewport: { width: 1440, height: 900 } })

const pane = (page: Page) => page.locator('.w-list-pane')

async function shot(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

test('Ops opens a ticket beside the dashboard, and the dashboard stays', async ({ page }, info) => {
  await signIn(page, 'bert.velilla@example.com')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('split-empty')).toContainText('No ticket open')
  await shot(page, info, 'ops-empty-pane')

  const card = pane(page).getByRole('link', { name: /Walk-in cooler not holding temp/ })
  await card.click()
  await expect(page).toHaveURL(/\/ops\/tickets\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp', level: 1 })).toBeVisible()
  await expect(pane(page).getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(card).toHaveAttribute('aria-current', 'page')
  await shot(page, info, 'ops-ticket-beside-list')

  // Another card swaps the ticket, not the list.
  await pane(page)
    .getByRole('link', { name: /OT-1031/ })
    .click()
  await expect(page.getByRole('heading', { name: 'Bar sink draining slowly', level: 1 })).toBeVisible()
  await expect(card).not.toHaveAttribute('aria-current', 'page')

  // A reload keeps the ticket, with the dashboard beside it.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bar sink draining slowly', level: 1 })).toBeVisible()
  await expect(pane(page).getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // Closed tickets keeps its own place beside a closed ticket.
  await page.goto('/ops/closed')
  await expect(pane(page).getByRole('heading', { name: 'Closed tickets' })).toBeVisible()
  await pane(page)
    .getByRole('button', { name: /See October/ })
    .click()
  await pane(page).locator('a[href^="/ops/tickets/"]').first().click()
  await expect(page).toHaveURL(/\/ops\/tickets\//)
  await expect(pane(page).getByRole('heading', { name: 'Closed tickets' })).toBeVisible()
  await shot(page, info, 'ops-closed-beside-list')
})

test('a manager’s Open tickets opens a ticket beside it', async ({ page }, info) => {
  await signIn(page, 'maya.reyes@example.com')
  await pane(page)
    .getByRole('link', { name: /Walk-in cooler not holding temp/ })
    .click()
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp', level: 1 })).toBeVisible()
  await expect(pane(page).getByRole('heading', { name: 'Open tickets' })).toBeVisible()
  await shot(page, info, 'manager-ticket-beside-list')
})

test('leadership reads a restaurant’s tickets beside it', async ({ page }, info) => {
  await signIn(page, 'lee.chen@example.com')
  await page.getByRole('navigation', { name: 'Leadership' }).getByRole('link', { name: 'Restaurants' }).click()
  await expect(page).toHaveURL(/\/lead\/restaurants\//)
  await pane(page).locator('a[href^="/lead/tickets/"]').first().click()
  await expect(page).toHaveURL(/\/lead\/tickets\//)
  await expect(pane(page).locator('a[href^="/lead/tickets/"][aria-current="page"]')).toHaveCount(1)
  await shot(page, info, 'lead-ticket-beside-restaurant')

  // Straight from a link there is no restaurant to show, so the ticket has the width.
  await page.reload()
  await expect(pane(page)).toHaveCount(0)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a ticket replaces the list and has no tab bar', async ({ page }) => {
    await signIn(page, 'bert.velilla@example.com')
    await expect(page.getByTestId('tab-bar')).toBeVisible()
    await page.getByRole('link', { name: /Walk-in cooler not holding temp/ }).click()
    await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0)
    await expect(page.getByTestId('tab-bar')).toHaveCount(0)
  })
})
