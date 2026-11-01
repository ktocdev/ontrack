import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Manager · Edit, Close and Reopen against the seed. Anything changed is a ticket
 * this test makes as Ari at Ranalli's. Maya's seeded tickets are only read, since the
 * Open tickets tests count them. OT-0911 stays past the 30 days whatever day this runs.
 */

const T0911 = '66666666-6666-4666-8666-000000000911'
const T1028 = '66666666-6666-4666-8666-000000001028'

async function newTicket(page: Page, title: string) {
  await page.goto('/tickets/new')
  await page.getByRole('link', { name: /^Refrigeration/ }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill('Bin is leaking.')
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await expect(page).toHaveURL(/\/tickets$/)
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

test('a manager edits a ticket: description, urgency and equipment', async ({ page }, testInfo) => {
  const title = `Edit me ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await newTicket(page, title)
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit ticket' })).toBeVisible()
  await expect(page.getByLabel('Description')).toHaveValue('Bin is leaking.')
  await expect(page.getByText('Back of House', { exact: true })).toBeVisible()
  await testInfo.attach('edit', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByLabel('Description').fill('Bin is leaking badly.')
  await page.getByRole('radiogroup', { name: 'Urgency' }).getByRole('radio', { name: 'Urgent' }).click()
  await page.getByRole('button', { name: 'Change', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Change equipment' })
  await sheet.getByRole('radio').first().click()
  const unit = (await sheet.getByRole('radio').first().locator('span').nth(2).textContent())!
  await sheet.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Changes saved.' })).toBeVisible()
  await expect(page.getByText('Bin is leaking badly.')).toBeVisible()
  await expect(page.getByText('URGENT')).toBeVisible()
  await expect(page.getByText(unit, { exact: true })).toBeVisible()
})

test('a manager closes a ticket, sees its screen, and reopens it with a reason', async ({ page }, testInfo) => {
  const title = `Close me ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await newTicket(page, title)
  await page.getByRole('link', { name: 'Edit', exact: true }).click()

  await page.getByRole('button', { name: 'Close ticket' }).click()
  const confirm = page.getByRole('dialog', { name: /^Close OT-\d+\?$/ })
  await confirm.getByLabel('Comment').fill('Tightened the drain line.')
  await page.waitForTimeout(300)
  await testInfo.attach('close-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await confirm.getByRole('button', { name: 'Close ticket' }).click()

  await expect(page.getByText('Your comment: "Tightened the drain line."')).toBeVisible()
  await expect(page.getByLabel('Description')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  await testInfo.attach('just-closed', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('link', { name: 'View closed ticket' }).click()
  await expect(page.getByRole('heading', { name: 'Closed ticket' })).toBeVisible()
  await expect(page.getByText('Tightened the drain line.')).toBeVisible()
  await expect(page.getByText(/^Closed [A-Z][a-z]{2} \d+, \d{4}$/)).toBeVisible()
  await expect(page.getByText('Under a day')).toBeVisible()
  await expect(page.getByText('You can report this to Ops for 30 more days.')).toBeVisible()
  await expect(page.getByRole('textbox', { name: /Write an update/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0)
  // Ari has no see_costs.
  await expect(page.getByText('Cost', { exact: true })).toHaveCount(0)

  // Gone from the open list while closed.
  await page.getByRole('link', { name: 'Back to open tickets' }).click()
  await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
  await page.goBack()

  await page.getByRole('button', { name: 'Reopen ticket' }).click()
  const ask = page.getByRole('dialog', { name: 'Is the problem back?' })
  await expect(ask.getByRole('button', { name: 'Reopen ticket' })).toBeDisabled()
  await ask.getByLabel("What's happening?").fill('Leaking again by close.')
  await page.waitForTimeout(300)
  await testInfo.attach('reopen-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await ask.getByRole('button', { name: 'Reopen ticket' }).click()

  await expect(page.getByText(/Reopened and sent to Ops\./)).toBeVisible()
  await expect(page.getByText('Waiting on Ops')).toBeVisible()
  await expect(page.getByText('You reopened this')).toBeVisible()
  await expect(page.getByText('Tightened the drain line.')).toBeVisible()
  await testInfo.attach('reopened', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  // On the way back it is an open ticket again, first in the list, with the reason in its thread.
  await page.getByRole('link', { name: 'Back to open tickets' }).click()
  const card = page.getByRole('link', { name: /^OT-/ }).first()
  await expect(card).toContainText(title)
  await expect(card).toContainText('Reopened')
  await card.click()
  const log = page.getByRole('log', { name: 'Ticket updates' })
  await expect(log.getByText(/^Reopened by you · /)).toBeVisible()
  await expect(log.getByText('Leaking again by close.')).toBeVisible()
})

test('with see_costs a closed ticket shows its contractor and cost', async ({ page }, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/tickets/${T1028}`)
  await expect(page.getByRole('heading', { name: 'Closed ticket' })).toBeVisible()
  await expect(page.getByText('Closing comment · Bert Velilla, Ops')).toBeVisible()
  await expect(page.getByText('Contractor', { exact: true })).toBeVisible()
  await expect(page.getByText('Cost', { exact: true })).toBeVisible()
  await expect(page.getByText(/^\$[\d,]+\.\d{2}$/)).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('closed', { body: await page.screenshot(), contentType: 'image/png' })
})

test('without see_costs the same kind of ticket has no contractor or cost', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/tickets/66666666-6666-4666-8666-000000001019') // Ranalli's, closed
  await expect(page.getByRole('heading', { name: 'Closed ticket' })).toBeVisible()
  await expect(page.getByText('Pipeworks replaced the cartridge.')).toBeVisible()
  await expect(page.getByText('Contractor', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Cost', { exact: true })).toHaveCount(0)
})

test('past 30 days it offers a new ticket linked to the old one', async ({ page }, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/tickets/${T0911}`)
  await expect(page.getByRole('button', { name: 'Reopen ticket' })).toHaveCount(0)
  await expect(page.getByText('Closed more than 30 days ago. Starts a new ticket with OT-0911 linked.')).toBeVisible()
  await testInfo.attach('expired', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('link', { name: 'Create ticket from this' }).click()

  await expect(page.getByRole('heading', { name: 'New ticket' })).toBeVisible()
  await expect(page.getByLabel('Title')).toHaveValue('Evaporator fan noisy')
  await expect(page.getByRole('radio', { name: /Walk-in Cooler 1/ })).toHaveAttribute('aria-checked', 'true')

  // Maya's tickets stay as seeded, so this only checks what would be sent.
  let sent: Record<string, unknown> = {}
  await page.route('**/rest/v1/tickets*', (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    sent = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({ status: 500, json: { message: 'stopped by the test' } })
  })
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(sent.parent_ticket_id).toBe(T0911)
})

test('a closed ticket has nothing to edit', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/tickets/${T1028}/edit`)
  await expect(page).toHaveURL(new RegExp(`/tickets/${T1028}$`))
  await expect(page.getByRole('heading', { name: 'Closed ticket' })).toBeVisible()
})
