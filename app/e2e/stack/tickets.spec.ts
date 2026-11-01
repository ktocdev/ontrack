import { expect, test, type Page } from '@playwright/test'
import { SEED_PASSWORD, signIn } from './helpers'

/** Manager · Open tickets against the seed: Maya manages Logan Square, Ari manages Ranalli's. */

const cards = (page: Page) => page.getByRole('link', { name: /^OT-/ })

test('a manager sees their open tickets in the board order, with the reopened one first', async ({
  page,
}, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
  await expect(cards(page)).toHaveCount(5)
  await expect(cards(page).first()).toContainText('OT-0988')
  await expect(cards(page).first()).toContainText('Reopened')
  await expect(cards(page).first()).toContainText('Back of House · Refrigeration · Walk-in Cooler 1')
  await expect(cards(page).first()).toContainText('Assigned: Bert Velilla')
  await expect(cards(page).nth(1)).toContainText('OT-1042')
  await expect(cards(page).nth(1)).toContainText('Walkthrough')
  await expect(cards(page).nth(1)).toContainText('Updated 1h ago')
  await expect(cards(page).nth(2)).toContainText('Not yet assigned')
  await expect(cards(page).nth(2)).toContainText('Created 3h ago')
  await expect(cards(page).nth(4)).toContainText(/Scheduled [A-Z][a-z]{2}/)

  const tabs = page.getByRole('navigation', { name: 'Ticket or in-house view' })
  await expect(tabs.getByRole('link', { name: 'Tickets 5' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'In-house 5' })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('open-tickets', { body: await page.screenshot(), contentType: 'image/png' })

  await cards(page).first().click()
  await expect(page).toHaveURL(/\/tickets\/66666666-6666-4666-8666-000000000988$/)
})

test('another restaurant’s tickets stay out, whatever is searched', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  await expect(page.getByText('Ranalli’s Logan Square')).toBeVisible()
  await expect(cards(page).first()).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search tickets' }).fill('Door gasket')
  await expect(page.getByRole('heading', { name: 'No open tickets match "Door gasket"' })).toBeVisible()
})

test('Front and Back narrow the list, and their counts follow the search', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  const area = page.getByRole('radiogroup', { name: 'Area' })
  await expect(area.getByRole('radio', { name: 'All · 5' })).toHaveAttribute('aria-checked', 'true')

  await area.getByRole('radio', { name: 'Front · 2' }).click()
  await expect(cards(page)).toHaveCount(2)
  await area.getByRole('radio', { name: 'Back · 3' }).click()
  await expect(cards(page)).toHaveCount(3)
  await area.getByRole('radio', { name: 'All · 5' }).click()

  await page.getByRole('searchbox', { name: 'Search tickets' }).fill('cooler')
  await expect(area.getByRole('radio', { name: 'All · 2' })).toBeVisible()
  await expect(area.getByRole('radio', { name: 'Front · 0' })).toBeVisible()
  await expect(cards(page)).toHaveCount(2)

  await area.getByRole('radio', { name: 'Front · 0' }).click()
  await expect(page.getByRole('heading', { name: 'Nothing open in Front of House' })).toBeVisible()
  await area.getByRole('radio', { name: 'All · 2' }).click()

  await page.getByRole('searchbox', { name: 'Search tickets' }).fill('1042')
  await expect(cards(page)).toHaveCount(1)
})

test('a search with no match says so, and clearing brings the list back', async ({ page }, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  const search = page.getByRole('searchbox', { name: 'Search tickets' })
  await search.fill('freezer')
  await expect(page.getByRole('heading', { name: 'No open tickets match "freezer"' })).toBeVisible()
  await expect(page.getByText('5 open', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'All · 0' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Ticket or in-house view' })).toHaveCount(0)
  await testInfo.attach('no-results', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Clear search', exact: true }).last().click()
  await expect(search).toHaveValue('')
  await expect(cards(page)).toHaveCount(5)
})

test('with nothing open it says so and offers Create ticket, without a QR button', async ({ page }, testInfo) => {
  await page.route('**/rest/v1/tickets*', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/inhouse_fixes*', (route) =>
    route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' }),
  )
  await signIn(page, 'maya.reyes@example.com')
  await expect(page.getByRole('heading', { name: 'No open tickets' })).toBeVisible()
  await expect(page.getByText('Everything at Federale’s Logan Square is working.')).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Ticket or in-house view' })).toHaveCount(0)
  await expect(page.getByText(/QR/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More ticket options' })).toBeVisible()
  await testInfo.attach('empty', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('link', { name: 'Create ticket' }).first().click()
  await expect(page).toHaveURL(/\/tickets\/new$/)
})

test('it loads in the layout it found last time, so an empty list does not jump', async ({ page }) => {
  // Holds the list back, so the test can look at the screen while it loads.
  let release = () => {}
  let answer: 'empty' | 'real' = 'empty'
  let held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/rest/v1/tickets*', async (route) => {
    await held
    return answer === 'empty' ? route.fulfill({ json: [] }) : route.continue()
  })
  await page.route('**/rest/v1/inhouse_fixes*', (route) =>
    answer === 'empty'
      ? route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' })
      : route.continue(),
  )
  const holdAndReload = async () => {
    held = new Promise<void>((resolve) => (release = resolve))
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
  }

  // The first time it can't know, so it draws the list.
  await page.goto('/sign-in')
  await page.getByLabel('Work email').fill('maya.reyes@example.com')
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(page.getByText('Loading open tickets')).toBeAttached()
  release()
  await expect(page.getByRole('heading', { name: 'No open tickets' })).toBeVisible()

  // It found nothing, so next time it loads with only the title.
  await holdAndReload()
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.getByText('Loading open tickets')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No open tickets' })).toHaveCount(0)
  release()
  await expect(page.getByRole('heading', { name: 'No open tickets' })).toBeVisible()

  // A hint that has gone stale gives way to the real list, and is forgotten.
  answer = 'real'
  await holdAndReload()
  release()
  await expect(cards(page)).toHaveCount(5)
  await holdAndReload()
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(page.getByText('Loading open tickets')).toBeAttached()
  release()
  await expect(cards(page)).toHaveCount(5)
})

test('a failed load offers Try again', async ({ page }) => {
  let fail = true
  await page.route('**/rest/v1/tickets*', (route) =>
    fail ? route.fulfill({ status: 500, json: { message: 'nope' } }) : route.continue(),
  )
  await signIn(page, 'maya.reyes@example.com')
  await expect(page.getByRole('heading', { name: "We couldn't load your tickets" })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(cards(page)).toHaveCount(5)
})

test('View as shows that person’s tickets, and none of them are links', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/users/22222222-2222-4222-8222-000000000001/view')
  await expect(page.getByText('Viewing as Maya Reyes')).toBeVisible()
  await expect(page.getByText('OT-1042')).toBeVisible()
  await expect(page.getByText('OT-1044')).toHaveCount(0) // Porter's, which the admin could read
  await expect(page.getByRole('link', { name: /^OT-/ })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Ticket or in-house view' }).getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More ticket options' })).toHaveCount(0)
})

test('the menu beside the search leads to closed tickets, and back', async ({ page }, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await page.waitForTimeout(200)
  await testInfo.attach('menu', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('menuitem', { name: 'View Closed Tickets' }).click()

  await expect(page.getByRole('heading', { name: 'Closed tickets' })).toBeVisible()
  await expect(cards(page).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /OT-1042/ })).toHaveCount(0) // still open
  const order = await cards(page).allTextContents()
  const newer = order.findIndex((t) => t.includes('OT-1028'))
  const older = order.findIndex((t) => t.includes('OT-0911'))
  expect(newer).toBeGreaterThanOrEqual(0)
  expect(newer).toBeLessThan(older)
  await expect(cards(page).nth(newer)).toContainText('Closed by Bert Velilla')
  await page.waitForTimeout(300)
  await testInfo.attach('closed-list', { body: await page.screenshot(), contentType: 'image/png' })

  await cards(page).nth(newer).click()
  await expect(page.getByRole('heading', { name: 'Closed ticket', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Back to closed tickets' }).click()
  await expect(page.getByRole('heading', { name: 'Closed tickets' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to open tickets' }).click()
  await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
})

test('closed tickets at another restaurant stay out', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/tickets/closed')
  await expect(page.getByRole('link', { name: /OT-1019/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /OT-1028/ })).toHaveCount(0)
})

test('with no closed tickets it says so, and a failed load offers Try again', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.route('**/rest/v1/tickets*', (route) => route.fulfill({ json: [] }))
  await page.goto('/tickets/closed')
  await expect(page.getByRole('heading', { name: 'No closed tickets yet' })).toBeVisible()

  await page.unroute('**/rest/v1/tickets*')
  let fail = true
  await page.route('**/rest/v1/tickets*', (route) =>
    fail ? route.fulfill({ status: 500, json: { message: 'nope' } }) : route.continue(),
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: "We couldn't load your closed tickets" })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(cards(page).first()).toBeVisible()
})
