import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Service record and Edit service record (OT-93) against the seed. The seed's own visit
 * on OT-1042 is only read; visits that change are made here through log_service, as
 * Bert, and stay (a record is never deleted), so their titles carry the browser and time.
 */

test.use({ timezoneId: 'America/Chicago' })

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const BERT = 'bert.velilla@example.com'
const T1042 = '66666666-6666-4666-8666-000000001042'
const COOLER = '44444444-4444-4444-8444-000000000001'
const COLDLINE = '55555555-5555-4555-8555-000000000001'
const LOGAN = '11111111-1111-4111-8111-000000000001'
const SEED_RECORD = '77777777-7777-4777-8777-000000000001'

const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`
const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') })

/** Logs a visit as Bert through the API and returns its id. */
async function logVisit(request: APIRequestContext, args: Record<string, unknown>) {
  const token = await tokenFor(request, BERT)
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/log_service`, {
    data: { p_service_date: '2026-11-04', ...args },
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
  expect(res.ok(), await res.text()).toBe(true)
  return (await res.json()) as string
}

test('the seed’s visit on OT-1042: invoice, cost line by line and details, from the ticket and back', async ({
  page,
}, testInfo) => {
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T1042}`)
  await page
    .getByRole('region', { name: 'Service & cost' })
    .getByRole('link', { name: /Condenser fan motor replaced/ })
    .click()
  await expect(page).toHaveURL(new RegExp(`/ops/service/${SEED_RECORD}$`))

  await expect(page.getByText('Service record', { exact: true })).toBeVisible()
  await expect(page.getByText('Walk-in Cooler 1 ·')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Condenser fan motor replaced' })).toBeVisible()
  await expect(page.getByText('Oct 19, 2026', { exact: true })).toBeVisible()
  await expect(page.getByText('Replaced the condenser fan motor and run capacitor.', { exact: false })).toBeVisible()
  await expect(page.getByText('Coldline_INV-58213.pdf')).toBeVisible()
  await expect(page.getByText('Attached by Bert Velilla · Oct 19')).toBeVisible()
  await expect(page.getByText('Labor · 2 hrs')).toBeVisible()
  await expect(page.getByText('Parts · fan motor, capacitor')).toBeVisible()
  await expect(page.getByText('$397.40')).toBeVisible()
  await expect(page.getByText('Rosa Alvarez')).toBeVisible()
  await expect(page.getByText('Bert Velilla · Oct 19, 4:50 PM')).toBeVisible()
  await expect(page.getByRole('link', { name: /Ticket\s*OT-1042/ })).toHaveAttribute('href', `/ops/tickets/${T1042}`)
  await expect(page.getByRole('link', { name: /Equipment\s*Walk-in Cooler 1/ })).toHaveAttribute(
    'href',
    `/ops/equipment/${COOLER}`,
  )
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible()
  await expect(page.getByText(/delete/i)).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('service-record', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  // Back returns to the ticket it was opened from.
  await page.getByRole('link', { name: 'Back to Walk-in Cooler 1' }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/tickets/${T1042}$`))
})

test('a visit with no invoice says Missing, takes one, then replaces it', async ({ page, request }, testInfo) => {
  const title = `Quarterly coil cleaning ${run(testInfo.project.name)}`
  const id = await logVisit(request, {
    p_kind: 'contractor',
    p_restaurant_id: LOGAN,
    p_equipment_id: COOLER,
    p_contractor_id: COLDLINE,
    p_title: title,
    p_labor_cents: 18000,
  })
  await signIn(page, BERT)

  // From the unit's log, where its row says No invoice.
  await page.goto(`/ops/equipment/${COOLER}/service`)
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/service/${id}$`))
  await expect(page.getByText('Missing invoice')).toBeVisible()
  await expect(page.getByText('Ticket', { exact: true })).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('missing-invoice', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByLabel('Attach invoice').setInputFiles(pdf('Coldline_PM-1.pdf'))
  await expect(page.getByRole('status').filter({ hasText: 'Invoice attached.' })).toBeVisible()
  await expect(page.getByText('Missing invoice')).toHaveCount(0)
  await expect(page.getByText('Coldline_PM-1.pdf')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View' })).toHaveAttribute(
    'href',
    /\/storage\/v1\/object\/sign\/invoices\//,
  )
  await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute('href', /download=/)

  await page.getByLabel('Replace invoice').setInputFiles(pdf('Coldline_PM-2.pdf'))
  await expect(page.getByRole('status').filter({ hasText: 'Invoice replaced.' })).toBeVisible()
  await expect(page.getByText('Coldline_PM-2.pdf')).toBeVisible()

  // Back returns to the unit.
  await page.getByRole('link', { name: 'Back to Walk-in Cooler 1' }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/equipment/${COOLER}/service$`))
})

test('Edit corrects a visit and puts it on a ticket, with no Delete', async ({ page, request }, testInfo) => {
  const title = `Door hinge adjusted ${run(testInfo.project.name)}`
  const id = await logVisit(request, {
    p_kind: 'in_house',
    p_restaurant_id: LOGAN,
    p_equipment_id: COOLER,
    p_technician: 'Bert Velilla',
    p_title: 'Door hinge',
    p_parts_cents: 1200,
  })
  await signIn(page, BERT)
  await page.goto(`/ops/service/${id}`)
  await expect(page.getByText('Done by', { exact: true })).toBeVisible()
  await expect(page.getByText('Invoice', { exact: true })).toHaveCount(0)

  await page.getByRole('link', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: 'Edit service record' })).toBeVisible()
  await expect(page.getByLabel('What was done')).toHaveValue('Door hinge')
  await expect(page.getByRole('radio', { name: 'In-house' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Parts', { exact: true })).toHaveValue('$12.00')
  await expect(page.getByLabel('Equipment (optional)')).toHaveValue(COOLER)
  await expect(page.getByText(/delete/i)).toHaveCount(0)

  await page.getByLabel('What was done').fill(title)
  await expect(page.getByLabel('Labor', { exact: true })).toHaveCount(0)
  await page.getByLabel('Parts', { exact: true }).fill('45')
  await page.getByLabel('Ticket (optional)').selectOption(T1042)
  await expect(page.getByLabel('Equipment (optional)')).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('edit-service', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page).toHaveURL(new RegExp(`/ops/service/${id}$`))
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('$45.00').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Ticket\s*OT-1042/ })).toBeVisible()

  // And it is on the ticket now.
  await page.goto(`/ops/tickets/${T1042}`)
  await expect(page.getByRole('region', { name: 'Service & cost' })).toContainText(title)
})

test('Edit refuses an invoice number the contractor already has, keeping what was typed', async ({
  page,
  request,
}, testInfo) => {
  const id = await logVisit(request, {
    p_kind: 'contractor',
    p_restaurant_id: LOGAN,
    p_contractor_id: COLDLINE,
    p_invoice_number: `CL-${run(testInfo.project.name)}-E`,
    p_labor_cents: 5000,
  })
  await signIn(page, BERT)
  await page.goto(`/ops/service/${id}/edit`)
  await page.getByLabel('Technician').fill('Rosa Alvarez')
  await page.getByLabel('Invoice #').fill('INV-58213')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('INV-58213 is already logged on OT-1042 (Oct 19).')).toBeVisible()
  await expect(page.getByLabel('Technician')).toHaveValue('Rosa Alvarez')
  await expect(page).toHaveURL(/\/edit$/)
})

test('a record out of reach, or no record, is not found', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto('/ops/service/not-a-record')
  await expect(page.getByRole('heading', { name: 'Service record' })).toHaveCount(0)
  await expect(page.getByText("We can't find that page")).toBeVisible()
})
