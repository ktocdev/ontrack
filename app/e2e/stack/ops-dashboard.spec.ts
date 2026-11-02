import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Ops · Dashboard against the seed: Bert and Chris cover every restaurant. Other flows
 * add tickets as they run, so nothing here counts on how many there are.
 */

const BERT = 'bert.velilla@example.com'
const cards = (page: Page) => page.getByRole('link', { name: /OT-\d+/ })
const card = (page: Page, id: string) => page.getByRole('link', { name: new RegExp(id) })
const group = (page: Page, name: string) => page.getByRole('region', { name, exact: true })

test('Ops sees the open work under each restaurant, with the details on each card', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText(/All restaurants \(\d+\)/)).toBeVisible()

  // In the restaurants' order, each under its own label with a count.
  await expect(group(page, 'Federale’s Logan Square')).toBeVisible()
  const labels = await page.getByRole('heading', { level: 2 }).allTextContents()
  expect(labels.map((l) => l.split(' · ')[0])).toEqual([
    'Federale’s Logan Square',
    'Federale’s West Loop',
    'Porter',
    'Ranalli’s Logan Square',
  ])
  await expect(page.getByRole('heading', { name: /^Porter · \d+$/ })).toBeVisible()
  await expect(group(page, 'Porter').getByRole('link', { name: /OT-1044/ })).toBeVisible()
  await expect(group(page, 'Porter').getByRole('link', { name: /OT-1042/ })).toHaveCount(0)

  // Within a restaurant: urgent on top, then Front, then Back, whatever other flows have added.
  const logan = await group(page, 'Federale’s Logan Square').getByRole('link').allTextContents()
  const rank = logan.map((t) => (t.includes('URGENT') ? 0 : t.includes('FOH') ? 1 : 2))
  expect(rank).toEqual([...rank].sort())
  expect(new Set(rank)).toEqual(new Set([0, 1, 2]))

  // A reopened ticket is an ordinary card with its pill, and says when it was opened.
  await expect(card(page, 'OT-0988')).toContainText('Reopened')
  await expect(card(page, 'OT-0988')).toContainText(/BOH · Refrigeration · \d+d ago/)

  // Nobody assigns: an open ticket says Open, and every ticket shows who is on it.
  await expect(card(page, 'OT-1044')).toContainText('Open')
  await expect(card(page, 'OT-1044')).not.toContainText('Unassigned')
  await expect(card(page, 'OT-1042')).toContainText('Walkthrough')
  await expect(card(page, 'OT-1042').getByTitle(/is working on this/)).toHaveCount(0) // Bert's own
  await expect(page.getByTitle('Chris Novak is working on this').first()).toHaveText('Chris Novak')

  await page.waitForTimeout(300)
  await testInfo.attach('dashboard', { body: await page.screenshot(), contentType: 'image/png' })

  await card(page, 'OT-1042').click()
  await expect(page).toHaveURL(/\/ops\/tickets\/66666666-6666-4666-8666-000000001042$/)
})

test('closed tickets are in the menu, and there is no tab for them', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await expect(page.getByRole('navigation', { name: 'Ticket status' })).toHaveCount(0)
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await page.waitForTimeout(200)
  await testInfo.attach('menu', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('menuitem', { name: 'View Closed Tickets' }).click()
  await expect(page).toHaveURL(/\/ops\/closed$/)
})

test('the picker narrows to one restaurant and is remembered', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await page.getByRole('button', { name: /All restaurants \(\d+\)/ }).click()
  await page.waitForTimeout(200)
  await testInfo.attach('picker', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('menuitemradio', { name: 'Porter' }).click()

  await expect(card(page, 'OT-1044')).toBeVisible()
  await expect(card(page, 'OT-1042')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Porter', exact: true })).toBeVisible()

  await page.reload()
  await expect(card(page, 'OT-1044')).toBeVisible()
  await expect(card(page, 'OT-1042')).toHaveCount(0)

  await page.getByRole('button', { name: 'Porter', exact: true }).click()
  await page.getByRole('menuitemradio', { name: /^All restaurants/ }).click()
  await expect(card(page, 'OT-1042')).toBeVisible()
})

test('with nothing open it says all caught up and still offers closed tickets', async ({ page }, testInfo) => {
  await page.route('**/rest/v1/tickets*', (route) => route.fulfill({ json: [] }))
  await signIn(page, BERT)
  await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible()
  await expect(page.getByText(/No open tickets across your \d+ restaurants\./)).toBeVisible()
  await expect(page.getByRole('button', { name: 'More ticket options' })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('empty', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('link', { name: 'View closed tickets' }).click()
  await expect(page).toHaveURL(/\/ops\/closed$/)
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('a failed load offers Try again', async ({ page }) => {
  let fail = true
  await page.route('**/rest/v1/tickets*', (route) =>
    fail ? route.fulfill({ status: 500, json: { message: 'nope' } }) : route.continue(),
  )
  await signIn(page, BERT)
  await expect(page.getByRole('heading', { name: "We couldn't load the dashboard" })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(card(page, 'OT-1042')).toBeVisible()
})

test('View as shows that person’s dashboard, and none of it is a link', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/users/22222222-2222-4222-8222-000000000003/view')
  await expect(page.getByText('Viewing as Bert Velilla')).toBeVisible()
  await expect(page.getByText('OT-1042')).toBeVisible()
  await expect(page.getByTitle('Chris Novak is working on this').first()).toBeVisible()
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More ticket options' })).toHaveCount(0)
})
