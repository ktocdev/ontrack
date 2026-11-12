import { expect, test, type Locator, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * A contractor's page, Add and Edit contractor, Archive / Restore and Delete, and the
 * lasting link (OT-95), against the seed. Other flows log Coldline visits at Logan Square
 * as they run, so its amounts aren't pinned; Hobart's one visit at Porter is ($640,
 * invoice H-20931, OT-1023). The contractor this file adds is deleted at the end, since
 * it has no visits.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'
const COLDLINE = '55555555-5555-4555-8555-000000000001'
const HOBART = '55555555-5555-4555-8555-000000000005'
const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`
const tradeChip = (scope: Locator, name: string) =>
  scope.getByRole('group', { name: 'Trades' }).getByRole('button', { name, exact: true })

async function pickRestaurant(page: Page, name: string | null) {
  await page
    .getByRole('button', { name: /All restaurants \(\d+\)|^Porter$|^Federale/ })
    .first()
    .click()
  await page.getByRole('menuitemradio', { name: name ?? /^All restaurants/ }).click()
}

test('a card opens the contractor: trades, call and email, this year, details, visits and invoices', async ({
  page,
}, testInfo) => {
  await signIn(page, BERT)
  await page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: 'Contractors' }).click()
  await page.getByRole('article', { name: 'Coldline Refrigeration' }).getByRole('link').first().click()
  await expect(page).toHaveURL(new RegExp(`/ops/contractors/${COLDLINE}$`))

  await expect(page.getByRole('heading', { name: 'Coldline Refrigeration', level: 1 })).toBeVisible()
  await expect(page.getByText('Preferred', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Call Coldline Refrigeration' })).toHaveAttribute(
    'href',
    'tel:3125550187',
  )
  await expect(page.getByRole('link', { name: 'Email Coldline Refrigeration' })).toHaveAttribute(
    'href',
    'mailto:rosa@coldlinerefrigeration.example.com',
  )
  await expect(page.getByText(/^Spend · \d{4}$/)).toBeVisible()
  const details = page.getByText('Contact', { exact: true }).locator('../..')
  await expect(details).toContainText('Rosa Alvarez')
  await expect(details).toContainText('Through Jun 2027')
  await expect(details).toContainText('After hours: (312) 555-0190. Account #FC-2210.')

  await page.waitForTimeout(300)
  await testInfo.attach('contractor', { body: await page.screenshot(), contentType: 'image/png' })

  // Visits, newest first, each opening its service record, which comes back here.
  // Other flows add Coldline visits dated today, which can push this one past the first six.
  const more = page.getByRole('button', { name: /^Show all \d+ visits$/ })
  if (await more.isVisible()) await more.click()
  const visits = page.getByRole('link', { name: /Condenser fan motor replaced/ }).first()
  await expect(visits).toBeVisible()
  await visits.click()
  await expect(page.getByRole('heading', { name: 'Condenser fan motor replaced' })).toBeVisible()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/contractors/${COLDLINE}$`))

  // Invoices: the missing one is counted on the tab and said above the list.
  await page.getByRole('link', { name: /^Invoices/ }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/contractors/${COLDLINE}/invoices$`))
  await expect(page.getByRole('link', { name: /^Invoices \d+ missing/ })).toBeVisible()
  await expect(page.getByText(/\d+ visits? (has|have) no invoice\./)).toBeVisible()
  await expect(page.getByRole('link', { name: /Missing invoice/ }).first()).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('invoices', { body: await page.screenshot(), contentType: 'image/png' })
})

test('the page follows the restaurant picker: at Porter, Hobart has its one visit', async ({ page }) => {
  await signIn(page, BERT)
  await page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: 'Contractors' }).click()
  await pickRestaurant(page, 'Porter')
  await page.goto(`/ops/contractors/${HOBART}`)
  await expect(page.locator('p', { hasText: 'At' })).toContainText('Porter')
  await expect(page.getByText('$640.00').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Visits · 1' })).toBeVisible()
  await expect(page.getByText('Oct 11, 2026').first()).toBeVisible()
  await page.getByRole('link', { name: /^Invoices/ }).click()
  await expect(page.getByRole('link', { name: /H-20931/ })).toContainText('OT-1023')
  await expect(page.getByText(/has no invoice/)).toHaveCount(0)

  await page.getByRole('link', { name: 'Back to contractors' }).click()
  await pickRestaurant(page, null)
})

test('Ops adds a contractor, edits it, archives and restores it, and deletes it', async ({ page }, testInfo) => {
  const name = `Test Gutters ${run(testInfo.project.name)}`
  await signIn(page, BERT)
  await page.goto('/ops/contractors/new')
  const form = page.locator('form')

  // Required fields say what is missing.
  await form.getByRole('button', { name: 'Save contractor' }).click()
  await expect(form.getByText('Enter the company name.')).toBeVisible()
  await expect(form.getByText('Pick at least one trade.')).toBeVisible()
  await expect(form.getByText('Enter a phone number.')).toBeVisible()

  await form.getByLabel('Company name').fill(name)
  await tradeChip(form, 'Roofing').click()
  await tradeChip(form, 'General repair').click()
  await form.getByLabel('Contact name').fill('Luis Ortega')
  await form.getByLabel('Phone').fill('(773) 555-0142')
  await form.getByLabel('Email (optional)').fill('not an email')
  await form.getByRole('button', { name: 'Save contractor' }).click()
  await expect(form.getByText('That doesn’t look like an email.')).toBeVisible()
  await form.getByLabel('Email (optional)').fill('luis@example.com')
  await form.getByRole('switch', { name: 'Preferred contractor' }).click()
  await form.getByLabel('Insurance expires (optional)').fill('2027-03')
  await form.getByLabel('Notes (optional)').fill('Gate code 4410.')
  await page.waitForTimeout(300)
  await testInfo.attach('add', { body: await page.screenshot(), contentType: 'image/png' })
  await form.getByRole('button', { name: 'Save contractor' }).click()

  await expect(page.getByRole('status').filter({ hasText: `${name} added.` })).toBeVisible()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await expect(page.getByText('Roofing', { exact: true })).toBeVisible()
  await expect(page.getByText('General repair', { exact: true })).toBeVisible()
  await expect(page.getByText('Through Mar 2027')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No visits yet' })).toBeVisible()

  // A name already in the list is refused on the field.
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit contractor' })).toBeVisible()
  await form.getByLabel('Company name').fill('coldline refrigeration')
  await form.getByRole('button', { name: 'Save changes' }).click()
  await expect(form.getByText('A contractor by that name is already in the list.')).toBeVisible()
  await form.getByLabel('Company name').fill(name)
  await tradeChip(form, 'General repair').click()
  await form.getByLabel('Phone').fill('(773) 555-0199')
  await form.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved.' })).toBeVisible()
  await expect(page.getByText('(773) 555-0199')).toBeVisible()
  await expect(page.getByText('General repair', { exact: true })).toHaveCount(0)

  // Remove: archive, which leaves the directory for the Archived list.
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await form.getByRole('button', { name: 'Remove contractor' }).click()
  const sheet = page.getByRole('dialog', { name: `Archive ${name}?` })
  await expect(sheet).toContainText('Their visits and invoices stay')
  await page.waitForTimeout(250)
  await testInfo.attach('archive', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Archive contractor' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} archived.` })).toBeVisible()
  await expect(page.getByText('Archived', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'More options for this contractor' })).toBeVisible()

  await page.getByRole('link', { name: 'Back to contractors' }).click()
  await expect(page.getByRole('article', { name })).toHaveCount(0)
  await page.getByRole('button', { name: /^Archived · \d+/ }).click()
  await page.getByRole('link', { name: new RegExp(name) }).click()

  // Restore, then delete, which it allows with no visits.
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await form.getByRole('button', { name: 'Restore contractor' }).click()
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Restore contractor' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} restored.` })).toBeVisible()
  await expect(page.getByText('Archived', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await form.getByRole('button', { name: 'Remove contractor' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete instead' }).click()
  await page
    .getByRole('dialog', { name: `Delete ${name}?` })
    .getByRole('button', { name: 'Delete contractor' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: `${name} deleted.` })).toBeVisible()
  await expect(page).toHaveURL(/\/ops\/contractors$/)
  await expect(page.getByRole('article', { name })).toHaveCount(0)
})

test('a contractor with visits can be archived but not deleted, and says why', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto(`/ops/contractors/${COLDLINE}/edit`)
  await page.getByRole('button', { name: 'Remove contractor' }).click()
  const sheet = page.getByRole('dialog', { name: 'Archive Coldline Refrigeration?' })
  await expect(sheet.getByRole('button', { name: 'Delete instead' })).toBeDisabled()
  await expect(sheet.getByText('They have visits on record, so they can only be archived.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
})

test('a visit names its contractor, and the lasting link opens their page for Ops only', async ({
  page,
  browser,
}, testInfo) => {
  await signIn(page, BERT)
  await page.goto('/ops/service/77777777-7777-4777-8777-000000000008')
  await page.getByRole('link', { name: /Hobart Service/ }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/contractors/${HOBART}$`))

  await page.goto(`/c/${HOBART}`)
  await expect(page).toHaveURL(new RegExp(`/ops/contractors/${HOBART}$`))
  await expect(page.getByRole('heading', { name: 'Hobart Service', level: 1 })).toBeVisible()

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const maya = await context.newPage()
  await signIn(maya, 'maya.reyes@example.com')
  await maya.goto(`/c/${HOBART}`)
  await expect(maya.getByRole('heading', { name: "Contractors don't open here" })).toBeVisible()
  await maya.goto(`/ops/contractors/${HOBART}`)
  await expect(maya.getByRole('heading', { name: 'Hobart Service' })).toHaveCount(0)
  await context.close()
})
