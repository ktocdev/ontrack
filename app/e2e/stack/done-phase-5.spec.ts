import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Phase 5's done test as one flow: logging a $397.40 Coldline visit on a ticket raises that
 * unit's 2026 cost, Coldline's spend and the Closed tab's month total by the same amount,
 * with the invoice PDF openable from all three places. Maya at Logan Square reports a
 * problem on Walk-in Cooler 1; Bert (Ops) logs the visit from the ticket with its invoice
 * and closes the ticket. Other flows log visits too, so each figure is read just before and
 * compared after. A service record is never deleted, so this visit stays, under a title that
 * carries the browser and the time; the ticket is closed, so no other flow counts it open.
 */

test.use({ timezoneId: 'America/Chicago' })

const MAYA = 'maya.reyes@example.com'
const BERT = 'bert.velilla@example.com'
const COOLER = '44444444-4444-4444-8444-000000000001'
const COLDLINE = '55555555-5555-4555-8555-000000000001'
const VISIT_CENTS = 39740
const PDF = '%PDF-1.4\n% Coldline done test\n%%EOF\n'

const now = new Date()
const zone = { timeZone: 'America/Chicago' } as const
const YEAR = now.toLocaleDateString('en-US', { ...zone, year: 'numeric' })
const MONTH = now.toLocaleDateString('en-US', { ...zone, month: 'long' })

const cents = async (l: Locator) => Math.round(Number((await l.innerText()).replace(/[$,\s]/g, '')) * 100)
const shot = async (page: Page, testInfo: import('@playwright/test').TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

/** The three figures the visit should move, as Bert sees them with every restaurant shown. */
async function figures(page: Page) {
  await page.goto(`/ops/equipment/${COOLER}/service`)
  const unit = await cents(page.getByText(`${YEAR} cost`, { exact: true }).locator('xpath=preceding-sibling::span'))

  await page.goto(`/ops/contractors/${COLDLINE}`)
  const spend = await cents(page.getByText(`Spend · ${YEAR}`, { exact: true }).locator('xpath=preceding-sibling::*[1]'))

  await page.goto('/ops/closed')
  const month = page.getByRole('region', { name: MONTH, exact: true })
  await expect(month.getByRole('heading', { level: 2 })).toBeVisible()
  const closed = await cents(month.locator('h2 + span'))
  return { unit, spend, closed }
}

/** On a service record: the invoice is the one attached, and View opens the PDF. */
async function invoiceOpens(page: Page, request: APIRequestContext, title: string) {
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Coldline_INV-done.pdf')).toBeVisible()
  await expect(page.getByText('$397.40').first()).toBeVisible()
  const href = await page.getByRole('link', { name: 'View' }).getAttribute('href')
  expect(href).toMatch(/\/storage\/v1\/object\/sign\/invoices\//)
  const file = await request.get(href!)
  expect(file.ok()).toBe(true)
  expect(await file.text()).toBe(PDF)
}

test('a $397.40 Coldline visit raises the unit, the contractor and the month by the same amount', async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000)
  const stamp = `${testInfo.project.name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`
  const title = `Walk-in cooler warm again ${stamp}`
  const number = `INV-${stamp}`

  // Bert (Ops) on their own phone; Maya on hers.
  await signIn(page, BERT)
  const before = await figures(page)

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const maya = await context.newPage()
  try {
    // 1. Maya reports the cooler from its page, with the unit filled in.
    await signIn(maya, MAYA)
    await maya.goto(`/equipment/${COOLER}`)
    await maya.getByRole('link', { name: 'Create ticket for this equipment' }).click()
    await maya.getByLabel('Title').fill(title)
    await maya.getByLabel('Description').fill('Reads 45°F again since the fan motor was replaced.')
    await maya.getByRole('button', { name: 'Submit ticket' }).click()
    await maya
      .getByRole('dialog', { name: 'Add a photo?' })
      .getByRole('button', { name: 'Proceed without photo' })
      .click()
    await expect(maya.getByRole('status').filter({ hasText: /OT-\d+ created\./ })).toBeVisible()
  } finally {
    await context.close()
  }

  // 2. Bert opens it from the dashboard and logs Coldline's visit, with the invoice.
  await page.goto('/ops')
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const ticketPath = new URL(page.url()).pathname
  await page.getByRole('region', { name: 'Service & cost' }).getByRole('link', { name: '+ Log service' }).click()
  await expect(page.getByRole('heading', { name: 'Log service' })).toBeVisible()
  await page.getByLabel('Contractor company').selectOption({ label: 'Coldline Refrigeration' })
  await page.getByLabel('Technician').fill('Rosa Alvarez')
  await page.getByLabel('Invoice #').fill(number)
  await page.getByLabel('Labor', { exact: true }).fill('120')
  await page.getByLabel('Parts', { exact: true }).fill('212.40')
  await page.getByLabel('Trip / call-out fee', { exact: true }).fill('65')
  await expect(page.getByText('$397.40')).toBeVisible()
  await page.getByLabel('Work notes').fill('Condenser fan motor replaced under warranty; capacitor and trip billed.')
  await page.getByLabel('Attach invoice').setInputFiles({
    name: 'Coldline_INV-done.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(PDF),
  })
  await shot(page, testInfo, 'log-service')
  await page.getByRole('button', { name: 'Save to ticket & equipment' }).click()
  await expect(page).toHaveURL(new RegExp(`${ticketPath}$`))
  await expect(page.getByRole('status').filter({ hasText: 'Service logged.' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Service & cost' })).toContainText('$397.40')

  // 3. He closes the ticket with a comment.
  await page.getByRole('button', { name: /^Status/ }).click()
  await page.getByRole('menuitem', { name: 'Close ticket' }).click()
  const sheet = page.getByRole('dialog', { name: /^Close OT-\d+\?$/ })
  await sheet.getByLabel('Comment').fill('Coldline replaced the fan motor; holding 37°F.')
  await sheet.getByRole('button', { name: 'Close ticket' }).click()
  await expect(page.getByRole('status').filter({ hasText: /OT-\d+ closed\./ })).toBeVisible()

  // 4. Each figure rose by $397.40.
  const after = await figures(page)
  expect(after.unit - before.unit).toBe(VISIT_CENTS)
  expect(after.spend - before.spend).toBe(VISIT_CENTS)
  expect(after.closed - before.closed).toBe(VISIT_CENTS)

  // 5. The invoice opens from the Closed tab: the month, the ticket, its visit.
  const row = page.getByRole('region', { name: MONTH, exact: true }).getByRole('link', { name: new RegExp(title) })
  await expect(row).toContainText('$397.40')
  await shot(page, testInfo, 'closed-month')
  await row.click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const service = page.getByRole('region', { name: 'Service & cost' })
  await expect(service).toContainText('Ticket total')
  await shot(page, testInfo, 'closed-ticket')
  await service.getByRole('link', { name: new RegExp(title) }).click()
  await invoiceOpens(page, request, title)
  await shot(page, testInfo, 'service-record')

  // From the unit's service log.
  await page.goto(`/ops/equipment/${COOLER}/service`)
  await shot(page, testInfo, 'unit-service')
  await page
    .getByRole('region', { name: `Service log ${YEAR}` })
    .getByRole('link', { name: new RegExp(title) })
    .click()
  await invoiceOpens(page, request, title)

  // And from Coldline's visits.
  await page.goto(`/ops/contractors/${COLDLINE}`)
  await shot(page, testInfo, 'contractor')
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await invoiceOpens(page, request, title)
})
