import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Ops · Closed tickets against the seed, whose closed tickets are in October 2026 and
 * earlier. Other flows close tickets as they run, so this month may or may not be empty,
 * and it is mocked where that matters. Nothing here changes a ticket.
 */

// CI runs in UTC, and months and dates here follow the person's own zone.
test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'
const T1028 = '66666666-6666-4666-8666-000000001028'
const OCTOBER = { month: '2026-10-01', closed_count: 9, total_cents: 241860 }
const MAY = { month: '2026-05-01', closed_count: 1, total_cents: 3850 }

const row = (page: Page, id: string) => page.getByRole('link', { name: new RegExp(id) })

/** Opens the list with this month empty, whatever day it is and whatever other flows closed. */
async function openWithEmptyMonth(page: Page) {
  await page.route('**/rest/v1/rpc/closed_by_month', async (route) => {
    const res = await route.fetch()
    const months = (await res.json()) as { month: string }[]
    const now = new Date()
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    await route.fulfill({ response: res, json: months.filter((m) => m.month < current) })
  })
  await signIn(page, BERT)
  await page.goto('/ops/closed')
  await expect(page.getByRole('heading', { name: 'Nothing closed this month' })).toBeVisible()
}

test('the menu opens Closed tickets, and the arrow goes back', async ({ page }) => {
  await signIn(page, BERT)
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await page.getByRole('menuitem', { name: 'View Closed Tickets' }).click()
  await expect(page.getByRole('heading', { name: 'Closed tickets' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page).toHaveURL(/\/ops$/)
})

test('an empty month says so, then opens the month before with its total and costs', async ({ page }, testInfo) => {
  await openWithEmptyMonth(page)
  await expect(page.getByText(/ · 0 closed$/)).toBeVisible()
  await expect(page.getByText('$0.00')).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('empty', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: /^See October.* · 9 closed$/ }).click()
  await expect(page.getByRole('heading', { name: 'Nothing closed this month' })).toHaveCount(0)
  const october = page.getByRole('region', { name: /^October/ })
  await expect(october.getByText(/^October.* · 9 closed$/)).toBeVisible()
  await expect(october.getByText('$2,418.60')).toBeVisible()

  // The newest first, four to start.
  await expect(october.getByRole('link')).toHaveCount(4)
  await expect(october.getByRole('link').first()).toContainText('OT-1036')
  await expect(row(page, 'OT-1036')).toContainText('$310.00')
  await expect(row(page, 'OT-1036')).toContainText('Federale’s West Loop')
  await expect(row(page, 'OT-1036')).toContainText('Oct 17')
  await page.waitForTimeout(300)
  await testInfo.attach('october', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: /^Show 5 more from October/ }).click()
  await expect(october.getByRole('link')).toHaveCount(9)
  await expect(page.getByRole('button', { name: /^Show \d+ more/ })).toHaveCount(0)
  // A reopened ticket is open work: it is on the dashboard, not here.
  await expect(row(page, 'OT-0988')).toHaveCount(0)
  // A ticket with no service record shows no amount, rather than $0.00.
  await expect(row(page, 'OT-1029')).not.toContainText('$')

  // Earlier months keep coming, one at a time, until there are none.
  await page.getByRole('button', { name: /^See May.* · 1 closed$/ }).click()
  await expect(row(page, 'OT-0911')).toBeVisible()
  await page.getByRole('button', { name: /^See January/ }).click()
  await expect(row(page, 'OT-0820')).toBeVisible()
})

test('the picker narrows the months and the tickets', async ({ page }) => {
  await openWithEmptyMonth(page)
  await page.getByRole('button', { name: /All restaurants \(\d+\)/ }).click()
  await page.getByRole('menuitemradio', { name: 'Porter' }).click()
  await page.getByRole('button', { name: /^See October.* · 3 closed$/ }).click()
  await expect(page.getByRole('region', { name: /^October/ }).getByRole('link')).toHaveCount(3)
  await expect(row(page, 'OT-1022')).toBeVisible()
  await expect(row(page, 'OT-1036')).toHaveCount(0)
  // No earlier month at Porter, so nothing more to offer.
  await expect(page.getByRole('button', { name: /^See / })).toHaveCount(0)
})

test('without see_costs no month or ticket shows money', async ({ page }) => {
  const hidden = [
    { ...OCTOBER, total_cents: null },
    { ...MAY, total_cents: null },
  ]
  await page.route('**/rest/v1/rpc/closed_by_month', (route) => route.fulfill({ json: hidden }))
  await page.route('**/rest/v1/v_ticket_costs*', (route) => route.fulfill({ json: [] }))
  await signIn(page, BERT)
  await page.goto('/ops/closed')
  await expect(page.getByRole('heading', { name: 'Nothing closed this month' })).toBeVisible()
  await expect(page.getByText('$0.00')).toHaveCount(0)
  await page.getByRole('button', { name: /^See October/ }).click()
  await expect(row(page, 'OT-1036')).toBeVisible()
  await expect(page.getByText(/\$/)).toHaveCount(0)
})

test('a failed load offers Try again', async ({ page }) => {
  let fail = true
  await page.route('**/rest/v1/rpc/closed_by_month', (route) =>
    fail ? route.fulfill({ status: 500, json: { message: 'nope' } }) : route.continue(),
  )
  await signIn(page, BERT)
  await page.goto('/ops/closed')
  await expect(page.getByRole('heading', { name: "We couldn't load closed tickets" })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText(/ · \d+ closed$/).first()).toBeVisible()
})

test('a closed ticket shows how it ended, read-only, and goes back to the list', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1028}`)
  await expect(page.getByRole('heading', { name: 'Booth 12 upholstery torn' })).toBeVisible()
  await expect(page.getByText('OT-1028')).toBeVisible()
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Federale’s Logan Square.*Closed Oct 15/)).toBeVisible()
  await expect(page.getByText('Seat panel split along the seam, foam showing.')).toBeVisible()
  await expect(page.getByText('Your closing comment')).toBeVisible()
  await expect(page.getByText('Booth Doctor reupholstered the seat panel in matching vinyl.')).toBeVisible()
  await expect(page.getByText('Contractor', { exact: true }).locator('..')).toContainText(/\S/)
  await expect(page.getByText('$420.00')).toBeVisible()
  await expect(page.getByText('Opened', { exact: true })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('closed-ticket', { body: await page.screenshot(), contentType: 'image/png' })

  await expect(page.getByRole('button', { name: /^Status/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Back to closed tickets' }).click()
  await expect(page).toHaveURL(/\/ops\/closed$/)
})

test('another Ops manager’s closing comment names them', async ({ page }) => {
  await signIn(page, 'chris.novak@example.com')
  await page.goto(`/ops/tickets/${T1028}`)
  await expect(page.getByText('Closing comment · Bert Velilla, Ops')).toBeVisible()
})
