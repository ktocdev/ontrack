import { expect, test, type Locator, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Trades (OT-99) against the seed: Bert is Ops with Log cost, Maya manages Logan Square.
 * The main flow adds its own trade and gives it to a new contractor, so it stays (a
 * trade a contractor has can't be deleted); the name carries the run so reruns don't
 * clash. The seed's trades are only looked at.
 */

const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`
const row = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) })
const tradeChip = (scope: Locator, name: string) =>
  scope.getByRole('group', { name: 'Trades' }).getByRole('button', { name, exact: true })

async function openContractors(page: Page) {
  await signIn(page, 'bert.velilla@example.com')
  await page.getByRole('navigation', { name: 'Operations' }).getByRole('link', { name: 'Contractors' }).click()
  await expect(page.getByRole('heading', { name: 'Contractors', level: 1 })).toBeVisible()
}
async function openTrades(page: Page) {
  await page.getByRole('button', { name: 'More options for contractors' }).click()
  await page.getByRole('menuitem', { name: 'Trades' }).click()
  await expect(page.getByRole('heading', { name: 'Trades', level: 1 })).toBeVisible()
}

test('Ops adds a trade, gives it to a contractor with another, and turns it off', async ({ page }, testInfo) => {
  const id = run(testInfo.project.name)
  const trade = `Pest control ${id}`
  const company = `Test Pest & Cold ${id}`

  await openContractors(page)
  await openTrades(page)
  await expect(row(page, 'Refrigeration')).toBeVisible()

  // Add, and a name already on the list is refused.
  await page.getByRole('button', { name: 'Add trade' }).click()
  const add = page.getByRole('dialog', { name: 'Add trade' })
  await add.getByLabel('Name').fill('hvac')
  await add.getByRole('button', { name: 'Add trade' }).click()
  await expect(add.getByText('There is already a trade with that name.')).toBeVisible()
  await add.getByLabel('Name').fill(trade)
  await add.getByRole('button', { name: 'Add trade' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${trade} added.` })).toBeVisible()
  await expect(row(page, trade)).toContainText('No contractor has it yet')
  await page.waitForTimeout(250)
  await testInfo.attach('trades', { body: await page.screenshot(), contentType: 'image/png' })

  // A contractor with two trades: a tag for each, and found under both chips.
  await page.getByRole('link', { name: 'Back to contractors' }).click()
  await page.getByRole('link', { name: 'Add contractor' }).click()
  const form = page.locator('form')
  await form.getByLabel('Company name').fill(company)
  await tradeChip(form, 'Refrigeration').click()
  await tradeChip(form, trade).click()
  await form.getByLabel('Contact name').fill('Dee Park')
  await form.getByLabel('Phone').fill('(312) 555-0123')
  await page.waitForTimeout(250)
  await testInfo.attach('add contractor', { body: await page.screenshot(), contentType: 'image/png' })
  await form.getByRole('button', { name: 'Save contractor' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${company} added.` })).toBeVisible()
  await page.getByRole('link', { name: 'Back to contractors' }).click()
  const card = page.getByRole('article', { name: company })
  await expect(card).toContainText('Refrigeration')
  await expect(card).toContainText(trade)

  const chips = page.getByRole('button', { name: /^All · / }).locator('..')
  await chips.getByRole('button', { name: trade, exact: true }).click()
  await expect(card).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)
  await chips.getByRole('button', { name: 'Refrigeration', exact: true }).click()
  await expect(card).toBeVisible()
  await expect(page.getByRole('article', { name: 'Coldline Refrigeration' })).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await testInfo.attach('two trades', { body: await page.screenshot(), contentType: 'image/png' })

  // In use: Delete says why. Turn it off, and the add sheet no longer offers it.
  await openTrades(page)
  await row(page, trade).click()
  const menu = page.getByRole('dialog', { name: trade })
  await expect(menu.getByRole('button', { name: 'Delete trade' })).toBeDisabled()
  await expect(menu.getByText('A contractor has this trade, so it can be turned off but not deleted.')).toBeVisible()
  await menu.getByRole('button', { name: 'Turn off trade' }).click()
  await page
    .getByRole('dialog', { name: `Turn off ${trade}?` })
    .getByRole('button', { name: 'Turn off trade' })
    .click()
  await expect(page.getByText('Turned off', { exact: true })).toBeVisible()
  await expect(row(page, trade)).toContainText('Off')

  await page.getByRole('link', { name: 'Back to contractors' }).click()
  await expect(card).toContainText(trade)
  await page.getByRole('link', { name: 'Add contractor' }).click()
  await expect(tradeChip(form, 'Refrigeration')).toBeVisible()
  await expect(tradeChip(form, trade)).toHaveCount(0)
})

test('a trade nobody has can be renamed and deleted', async ({ page }, testInfo) => {
  const trade = `Awnings ${run(testInfo.project.name)}`
  await openContractors(page)
  await openTrades(page)
  await page.getByRole('button', { name: 'Add trade' }).click()
  await page.getByRole('dialog', { name: 'Add trade' }).getByLabel('Name').fill(trade)
  await page.getByRole('dialog', { name: 'Add trade' }).getByRole('button', { name: 'Add trade' }).click()
  await expect(row(page, trade)).toBeVisible()

  await row(page, trade).click()
  await page.getByRole('dialog', { name: trade }).getByRole('button', { name: 'Rename trade' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill(`${trade} & canopies`)
  await page.getByRole('dialog').getByRole('button', { name: 'Save name' }).click()
  const renamed = `${trade} & canopies`
  await expect(page.getByRole('status').filter({ hasText: `Renamed to ${renamed}.` })).toBeVisible()

  await row(page, renamed).click()
  await page.getByRole('dialog', { name: renamed }).getByRole('button', { name: 'Delete trade' }).click()
  await page
    .getByRole('dialog', { name: `Delete ${renamed}?` })
    .getByRole('button', { name: 'Delete trade' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: `${renamed} deleted.` })).toBeVisible()
  await expect(row(page, renamed)).toHaveCount(0)
})

test('an admin opens Trades from Restaurants', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/restaurants')
  await page.getByRole('link', { name: /^Trades/ }).click()
  await expect(page).toHaveURL(/\/admin\/restaurants\/trades$/)
  await expect(page.getByRole('button', { name: 'Add trade' })).toBeVisible()
  await expect(row(page, 'Retractable roofs & windows')).toBeVisible()
})

test('a manager has no way to Trades, and the Ops address is refused', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/ops/contractors/trades')
  await expect(page.getByRole('button', { name: 'Add trade' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Trades', level: 1 })).toHaveCount(0)
})
