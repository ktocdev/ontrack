import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * The contractor directory (OT-94) against the seed's twelve contractors. Other flows
 * add contractors and log visits at Logan Square as they run, so counts and Logan
 * Square's amounts aren't pinned; Porter's are, since nothing logs there.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'
const card = (page: Page, name: string) => page.getByRole('article', { name })
const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`

async function open(page: Page) {
  await signIn(page, BERT)
  await page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: 'Contractors' }).click()
  await expect(page.getByRole('heading', { name: 'Contractors', level: 1 })).toBeVisible()
}

test('the directory: each contractor with trade, preferred, contact, visits, spend and a call button', async ({
  page,
}, testInfo) => {
  await open(page)
  await expect(page.getByRole('button', { name: /^All · \d+$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Most used first')).toBeVisible()
  await expect(page.getByText(`Spend · ${new Date().getFullYear()}`)).toBeVisible()

  const coldline = card(page, 'Coldline Refrigeration')
  await expect(coldline).toContainText('Refrigeration')
  await expect(coldline).toContainText('Preferred')
  await expect(coldline).toContainText('Rosa Alvarez')
  await expect(coldline).toContainText(/\d+ visits? · last \w{3} \d+, \d{4}|No visits in \d{4}/)
  await expect(coldline).toContainText(/\$[\d,]+/)
  await expect(coldline.getByRole('link', { name: 'Call Coldline Refrigeration' })).toHaveAttribute(
    'href',
    'tel:3125550187',
  )
  // Brightway's insurance ran out on Nov 1, 2026: flagged before and after.
  await expect(card(page, 'Brightway Electric')).toContainText(/Insurance expire[sd] Nov 1/)
  await expect(card(page, 'Pipeworks Plumbing')).not.toContainText('Insurance')
  // Archived contractors aren't listed, and nothing opens a card until the contractor page (OT-95).
  await expect(coldline.getByRole('link', { name: /^Coldline/ })).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('directory', { body: await page.screenshot(), contentType: 'image/png' })
})

test('a trade chip narrows the list, and the order switches to highest spend', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Refrigeration', exact: true }).click()
  await expect(page.getByText(/^\d+ refrigeration contractors? · Most used first$/)).toBeVisible()
  await expect(card(page, 'Coldline Refrigeration')).toBeVisible()
  await expect(card(page, 'Northstar HVAC')).toHaveCount(0)

  await page.getByRole('button', { name: /^All · \d+$/ }).click()
  await page.getByRole('button', { name: 'Most used first. Change the order' }).click()
  await expect(page.getByText('Highest spend first')).toBeVisible()
  const amounts = await page
    .getByRole('article')
    .evaluateAll((els) => els.map((e) => Number((e.textContent?.match(/\$([\d,]+)/)?.[1] ?? '0').replace(/,/g, ''))))
  expect(amounts.length).toBeGreaterThan(2)
  expect([...amounts].sort((a, b) => b - a)).toEqual(amounts)
})

test('the picker scopes the spend: at Porter, Hobart has its visit and Coldline none', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: /All restaurants \(\d+\)/ }).click()
  await page.getByRole('menuitemradio', { name: 'Porter' }).click()
  await expect(card(page, 'Hobart Service')).toContainText('$640')
  await expect(card(page, 'Hobart Service')).toContainText('1 visit · last Oct 11, 2026')
  await expect(card(page, 'Coldline Refrigeration')).toContainText('$0')
  // Everyone is still listed: contractors are the group's.
  await expect(card(page, 'Pipeworks Plumbing')).toBeVisible()
  await page.getByRole('button', { name: 'Porter', exact: true }).click()
  await page.getByRole('menuitemradio', { name: /^All restaurants/ }).click()
})

test('search finds a company, contact or trade, and says so when nothing matches', async ({ page }, testInfo) => {
  await open(page)
  const search = page.getByRole('searchbox', { name: 'Search contractors' })
  await search.fill('rosa')
  await expect(card(page, 'Coldline Refrigeration')).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)

  await search.fill('roofing')
  await expect(page.getByRole('heading', { name: 'No contractors match "roofing"' })).toBeVisible()
  await expect(page.getByText(/None of your \d+ contractors match that company, contact or trade\./)).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('no-results', { body: await page.screenshot(), contentType: 'image/png' })

  // Add a roofing contractor starts the sheet on that trade.
  await page.getByRole('button', { name: 'Add a roofing contractor' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add contractor' })
  await expect(sheet.getByLabel('Trade')).toHaveValue('Roofing')
  await sheet.getByRole('button', { name: 'Cancel' }).click()

  // The button under the message; the search box's own X has the same name.
  await page.getByRole('button', { name: 'Clear search' }).last().click()
  await expect(search).toHaveValue('')
  await expect(card(page, 'Coldline Refrigeration')).toBeVisible()
})

test('Add puts a new contractor in the directory', async ({ page }, testInfo) => {
  // Not roofing: the search test looks for a roofer and expects none.
  const name = `Test Handyman ${run(testInfo.project.name)}`
  await open(page)
  await page.getByRole('button', { name: 'Add contractor' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add contractor' })
  await sheet.getByLabel('Company name').fill(name)
  await sheet.getByLabel('Trade').selectOption('General repair')
  await sheet.getByLabel('Phone (optional)').fill('(312) 555-0111')
  await sheet.getByRole('button', { name: 'Add contractor' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Contractor added.' })).toBeVisible()
  await expect(card(page, name)).toContainText('General repair')
  await expect(card(page, name)).toContainText(/No visits in \d{4}/)
})

test('with no contractors it says so and offers Add contractor', async ({ page }, testInfo) => {
  await page.route('**/rest/v1/contractors?*', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.continue(),
  )
  await open(page)
  await expect(page.getByRole('heading', { name: 'No contractors yet' })).toBeVisible()
  await expect(page.getByText('You can also add one while logging service on a ticket.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add contractor' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search contractors' })).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('empty', { body: await page.screenshot(), contentType: 'image/png' })
})
