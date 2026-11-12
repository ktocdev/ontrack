import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Log service & cost (OT-92) against the seed: from a ticket, as the board draws it, from
 * a unit with no ticket, and from a contractor; the saving state, an invoice number the
 * contractor already has, and "+ Add new contractor". Every visit logged here stays (a
 * record is never deleted), so names and invoice numbers carry the browser and the time.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'
const T1042 = '66666666-6666-4666-8666-000000001042'
const COOLER = '44444444-4444-4444-8444-000000000001'
const COLDLINE = '55555555-5555-4555-8555-000000000001'

const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`
const pdf = { name: 'Coldline_invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') }
const amount = (page: Page, label: string) => page.getByLabel(label, { exact: true })

async function fillCost(page: Page, labor: string, parts: string, trip: string) {
  await amount(page, 'Labor').fill(labor)
  await amount(page, 'Parts').fill(parts)
  await amount(page, 'Trip / call-out fee').fill(trip)
}

test('from a ticket: a contractor visit with its invoice, on the ticket and the unit', async ({ page }, testInfo) => {
  const number = `CL-${run(testInfo.project.name)}`
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1042}`)
  const section = page.getByRole('region', { name: 'Service & cost' })
  await expect(section).toContainText('Coldline Refrigeration')
  await expect(section).toContainText('Ticket total so far')
  const before = Number(
    (
      await section
        .getByText(/^\$[\d,]+\.\d\d$/)
        .last()
        .innerText()
    ).replace(/[$,]/g, ''),
  )

  await section.getByRole('link', { name: '+ Log service' }).click()
  await expect(page.getByRole('heading', { name: 'Log service' })).toBeVisible()
  await expect(page.getByText('OT-1042 · Walk-in Cooler 1')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Outside contractor' })).toHaveAttribute('aria-checked', 'true')

  const save = page.getByRole('button', { name: 'Save to ticket & equipment' })
  await expect(save).toBeDisabled()
  await page.getByLabel('Contractor company').selectOption({ label: 'Coldline Refrigeration' })
  await page.getByLabel('Technician').fill('Rosa Alvarez')
  await page.getByLabel('Invoice #').fill(number)
  await fillCost(page, '120', '212.40', '65')
  await amount(page, 'Labor').blur()
  await expect(amount(page, 'Labor')).toHaveValue('$120.00')
  await expect(page.getByText('$397.40')).toBeVisible()
  await page.getByLabel('Work notes').fill('Replaced failed condenser fan motor. Holding 37°F after 1 hr.')
  await page.getByLabel('Attach invoice').setInputFiles(pdf)
  await expect(page.getByText('Coldline_invoice.pdf')).toBeVisible()
  await page.waitForTimeout(250)
  await testInfo.attach('log-service', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  // The saving state, held long enough to see.
  await page.route('**/rest/v1/rpc/log_service', async (route) => {
    await new Promise((r) => setTimeout(r, 1200))
    await route.continue()
  })
  await save.click()
  await expect(page.getByRole('button', { name: 'Saving to ticket & equipment…' })).toBeVisible()
  await expect(page.getByLabel('Technician')).toBeDisabled()
  await testInfo.attach('saving', { body: await page.screenshot(), contentType: 'image/png' })

  await expect(page).toHaveURL(new RegExp(`/ops/tickets/${T1042}$`))
  await expect(page.getByRole('status').filter({ hasText: 'Service logged.' })).toBeVisible()
  const after = (before + 397.4).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  await expect(section).toContainText(after)
  await expect(section).toContainText('Walk-in cooler not holding temp')

  // On the unit's service log too, with the invoice on file.
  await page.goto(`/ops/equipment/${COOLER}/service`)
  // A row of the log: its date, title and line, the invoice mark, the amount.
  const row = page
    .getByRole('region', { name: /^Service log \d{4}$/ })
    .first()
    .locator('div[class*="min-h-[64px]"]')
    .filter({ hasText: 'Walk-in cooler not holding temp' })
    .filter({ hasText: '$397.40' })
    .first()
  await expect(row).toBeVisible()
  await expect(row.getByText('Invoice on file')).toBeAttached()
})

test('an invoice number the contractor already has is refused on its field, and nothing is lost', async ({
  page,
}, testInfo) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1042}/service/new`)
  await page.getByLabel('Contractor company').selectOption({ label: 'Coldline Refrigeration' })
  await page.getByLabel('Technician').fill('Rosa Alvarez')
  await page.getByLabel('Invoice #').fill('inv-58213')
  await fillCost(page, '120', '212.40', '65')
  await page.getByRole('button', { name: 'Save to ticket & equipment' }).click()

  await expect(page.getByText("Couldn't save yet.")).toBeVisible()
  await expect(page.getByText('Fix the invoice number below.')).toBeVisible()
  await expect(page.getByText('inv-58213 is already logged on OT-1042 (Oct 19).')).toBeVisible()
  await expect(page.getByLabel('Invoice #')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('link', { name: 'Think this is wrong? Report a problem' })).toHaveAttribute(
    'href',
    '/profile/help',
  )
  await expect(page.getByLabel('Technician')).toHaveValue('Rosa Alvarez')
  await expect(page).toHaveURL(/\/service\/new$/)
  await page.waitForTimeout(250)
  await testInfo.attach('save-failed', { body: await page.screenshot(), contentType: 'image/png' })

  // Fixing the number clears the refusal.
  await page.getByLabel('Invoice #').fill('INV-58213-B')
  await expect(page.getByText("Couldn't save yet.")).toHaveCount(0)
})

test('from a unit: in-house work with no ticket, done by you', async ({ page }, testInfo) => {
  const notes = `Cleaned the condenser coils ${run(testInfo.project.name)}`
  await signIn(page, BERT)
  await page.goto(`/ops/equipment/${COOLER}/service`)
  await page.getByRole('link', { name: '+ Log service' }).click()
  await expect(page.getByText('Walk-in Cooler 1', { exact: true })).toBeVisible()

  const ticket = page.getByLabel('Ticket (optional)')
  await expect(ticket).toHaveValue('')
  await expect(ticket.locator('optgroup[label="Open"] option', { hasText: 'OT-1042' })).toHaveCount(1)
  await page.getByRole('radio', { name: 'In-house' }).click()
  await expect(page.getByLabel('Done by')).toHaveValue('Bert Velilla')
  await expect(page.getByLabel('Contractor company')).toHaveCount(0)
  await fillCost(page, '', '38.5', '')
  await page.getByLabel('Work notes').fill(notes)
  await page.getByRole('button', { name: 'Save to equipment' }).click()

  await expect(page).toHaveURL(new RegExp(`/ops/equipment/${COOLER}/service$`))
  const log = page.getByRole('region', { name: /^Service log \d{4}$/ }).first()
  await expect(log.getByText('In-house work').first()).toBeVisible()
})

test('a bad amount is marked, and the total waits for it', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1042}/service/new`)
  await page.getByRole('radio', { name: 'In-house' }).click()
  await fillCost(page, '12.345', '10', '')
  await expect(amount(page, 'Labor')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('–', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save to ticket & equipment' })).toBeDisabled()
  await amount(page, 'Labor').fill('12.34')
  await expect(page.getByText('$22.34')).toBeVisible()
})

test('+ Add new contractor adds one and picks it, keeping the form', async ({ page }, testInfo) => {
  const name = `Test Glass ${run(testInfo.project.name)}`
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1042}/service/new`)
  await page.getByLabel('Technician').fill('Sam')
  await page.getByLabel('Contractor company').selectOption({ label: '+ Add new contractor' })
  const sheet = page.getByRole('dialog', { name: 'Add contractor' })
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Company name').fill(name)
  await sheet.getByLabel('Trade').selectOption('Retractable roofs & windows')
  await sheet.getByLabel('Phone (optional)').fill('(312) 555-0100')
  await sheet.getByRole('button', { name: 'Add contractor' }).click()

  await expect(sheet).toHaveCount(0)
  await expect(page.getByLabel('Contractor company').locator('option:checked')).toHaveText(name)
  await expect(page.getByLabel('Technician')).toHaveValue('Sam')

  // A name already in the list is refused in the sheet.
  await page.getByLabel('Contractor company').selectOption({ label: '+ Add new contractor' })
  await sheet.getByLabel('Company name').fill('coldline refrigeration')
  await sheet.getByLabel('Trade').selectOption('Refrigeration')
  await sheet.getByRole('button', { name: 'Add contractor' }).click()
  await expect(sheet.getByText('A contractor by that name is already in the list.')).toBeVisible()
})

test('from a contractor: the restaurant, then a unit and a ticket, both optional', async ({ page }, testInfo) => {
  const number = `CL-${run(testInfo.project.name)}-PM`
  await signIn(page, BERT)
  await page.goto(`/ops/contractors/${COLDLINE}/service/new`)
  // The header names the contractor (the picker's option says it too).
  await expect(page.getByRole('heading', { name: 'Log service' }).locator('..')).toContainText('Coldline Refrigeration')
  await expect(page.getByLabel('Contractor company').locator('option:checked')).toHaveText('Coldline Refrigeration')

  await page.getByLabel('Restaurant').selectOption({ label: 'Federale’s Logan Square' })
  await page.getByLabel('Equipment (optional)').selectOption({ label: 'Walk-in Cooler 1' })
  await expect(
    page.getByLabel('Ticket (optional)').locator('optgroup[label="Open"] option', { hasText: 'OT-1042' }),
  ).toHaveCount(1)
  await page.getByLabel('Invoice #').fill(number)
  await fillCost(page, '180', '', '')
  await page.waitForTimeout(250)
  await testInfo.attach('from-contractor', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: 'Save to equipment' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Service logged.' })).toBeVisible()
  await expect(page).toHaveURL(/\/ops\/contractors$/)
})

test('a manager has no way to log service, and the address is refused', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/ops/tickets/${T1042}/service/new`)
  await expect(page.getByRole('heading', { name: 'Log service' })).toHaveCount(0)
})
