import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * List and detail on a laptop (OT-159, OT-164): from 1024 px a list starts on its own, a
 * ticket opens beside it, and its X closes it again; the list keeps its place throughout.
 * The address is the ticket's own, so a reload keeps both. A phone shows one or the other.
 */

test.use({ viewport: { width: 1440, height: 900 } })

// The list, alone in the reading column or in the pane beside an open item.
const pane = (page: Page) => page.locator('[data-split-list]')
const alone = (page: Page) => expect(pane(page)).toHaveAttribute('data-split-list', 'alone')
const beside = (page: Page) => expect(pane(page)).toHaveAttribute('data-split-list', 'beside')

async function shot(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

test('Ops opens a ticket beside the dashboard, and the dashboard stays', async ({ page }, info) => {
  await signIn(page, 'bert.velilla@example.com')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await alone(page)
  await shot(page, info, 'ops-list-alone')

  const card = pane(page).getByRole('link', { name: /Walk-in cooler not holding temp/ })
  await card.click()
  await expect(page).toHaveURL(/\/ops\/tickets\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp', level: 1 })).toBeVisible()
  await beside(page)
  await expect(pane(page).getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(card).toHaveAttribute('aria-current', 'page')
  // The sidebar keeps Dashboard lit while one of its tickets is open.
  await expect(
    page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: 'Dashboard' }),
  ).toHaveAttribute('aria-current', 'page')
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

  // The X closes the ticket, and the dashboard has the column to itself again.
  await page.getByRole('link', { name: 'Close panel', exact: true }).click()
  await expect(page).toHaveURL(/\/ops$/)
  await alone(page)
  await expect(page.getByRole('heading', { name: 'Bar sink draining slowly', level: 1 })).toHaveCount(0)

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

test('Ops opens a unit beside the equipment list, and a contractor beside the directory', async ({ page }, info) => {
  await signIn(page, 'bert.velilla@example.com')
  const nav = page.getByRole('navigation', { name: 'Operations' })

  await nav.getByRole('link', { name: 'Equipment' }).click()
  await alone(page)
  await pane(page).getByLabel('Search equipment').fill('Walk-in Cooler 1')
  const unit = pane(page).locator('a[href^="/ops/equipment/"]', { hasText: 'Walk-in Cooler 1' }).first()
  await unit.click()
  await expect(page).toHaveURL(/\/ops\/equipment\/[0-9a-f-]+/)
  await expect(page.getByRole('heading', { name: 'Walk-in Cooler 1', level: 1 })).toBeVisible()
  await expect(unit).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Equipment' })).toHaveAttribute('aria-current', 'page')
  await shot(page, info, 'ops-unit-beside-list')

  await nav.getByRole('link', { name: 'Contractors' }).click()
  await alone(page)
  const coldline = pane(page).getByRole('article', { name: 'Coldline Refrigeration' })
  await coldline.getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: 'Coldline Refrigeration', level: 1 })).toBeVisible()
  await expect(pane(page).getByRole('heading', { name: 'Contractors', level: 1 })).toBeVisible()
  await expect(coldline.getByRole('link').first()).toHaveAttribute('aria-current', 'page')
  await shot(page, info, 'ops-contractor-beside-directory')

  // Invoices opens a service record beside it, and Contractors stays lit.
  await pane(page).getByRole('link', { name: 'Invoices' }).click()
  await expect(page).toHaveURL(/\/ops\/contractors\/invoices/)
  await pane(page).locator('a[href^="/ops/service/"]').first().click()
  await expect(page).toHaveURL(/\/ops\/service\//)
  await expect(pane(page).locator('a[href^="/ops/service/"][aria-current="page"]')).toHaveCount(1)
  await expect(nav.getByRole('link', { name: 'Contractors' })).toHaveAttribute('aria-current', 'page')
  await shot(page, info, 'ops-invoice-beside-invoices')
})

test('a manager opens a unit beside their equipment', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.getByRole('navigation', { name: 'Manager' }).getByRole('link', { name: 'Equipment' }).click()
  await alone(page)
  // The manager's list opens on Front of House with every group closed.
  await pane(page).getByRole('radio', { name: 'Back of House' }).click()
  await pane(page)
    .getByRole('button', { name: /Refrigeration/ })
    .first()
    .click()
  await pane(page).locator('a[href^="/equipment/"]', { hasText: 'Walk-in Cooler 1' }).click()
  await expect(page.getByRole('heading', { name: 'Walk-in Cooler 1', level: 1 })).toBeVisible()
  await expect(pane(page).getByRole('heading', { name: 'Equipment', level: 1 })).toBeVisible()
})

test('an admin opens a person beside Users', async ({ page }, info) => {
  await signIn(page, 'admin@example.com')
  await alone(page)
  await pane(page)
    .getByRole('link', { name: /Maya Reyes/ })
    .click()
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]+$/)
  await expect(pane(page).getByRole('heading', { name: 'Users', level: 1 })).toBeVisible()
  await expect(pane(page).getByRole('link', { name: /Maya Reyes/ })).toHaveAttribute('aria-current', 'page')
  await shot(page, info, 'admin-person-beside-users')
})

test('a manager’s Open tickets and In-house sit in the same column', async ({ page }, info) => {
  await signIn(page, 'maya.reyes@example.com')
  await alone(page)
  const openBox = (await page.locator('[data-screen="reading"]').first().boundingBox())!
  await page.getByRole('link', { name: /^In-house/ }).click()
  await expect(page).toHaveURL(/\/tickets\/in-house$/)
  const inHouseBox = (await page.locator('[data-screen="reading"]').first().boundingBox())!
  expect(inHouseBox.x).toBe(openBox.x)
  expect(inHouseBox.width).toBe(openBox.width)
  await shot(page, info, 'manager-in-house')
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
