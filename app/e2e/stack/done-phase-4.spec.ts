import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Phase 4's done test as one flow: Maya, a manager at Federale's Logan Square, finds a unit
 * by browsing Back of House and its category, creates a ticket from it with the unit filled
 * in, and the ticket shows under that unit's Tickets tab and on the Ops dashboard; then Bert
 * (Ops) adds a unit at Logan Square, which shows on Maya's list, and retires it, which takes
 * it off her list and out of the ticket form's picker. Maya has Add / edit equipment by
 * override, so the retired unit waits in her Retired card rather than vanishing; the check
 * is that it has left its category. At the end Ops closes the ticket and deletes the unit,
 * so no other flow counts them.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAYA = 'maya.reyes@example.com'
const BERT = 'bert.velilla@example.com'

const group = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const unitRow = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(`^${name}`) })
const shot = async (page: Page, testInfo: import('@playwright/test').TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

async function headers(request: APIRequestContext, email: string) {
  return { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, email)}` }
}

/** Maya's Equipment tab, on Back of House with Refrigeration open. */
async function mayaRefrigeration(page: Page) {
  await page.getByRole('link', { name: 'Equipment' }).click()
  await expect(page.getByRole('heading', { name: 'Equipment', level: 1 })).toBeVisible()
  await page.getByRole('radio', { name: 'Back of House' }).click()
  const head = group(page, 'Refrigeration').getByRole('button').first()
  await expect(head).toHaveAttribute('aria-expanded', 'false')
  await head.click()
  await expect(head).toHaveAttribute('aria-expanded', 'true')
}

test('a manager makes a ticket from a unit, and Ops adds a unit the manager sees and then retires it', async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000)
  const stamp = `${testInfo.project.name} ${Date.now() % 100000}`
  const title = `Cooler running warm ${stamp}`
  const unit = `Bar reach-in ${stamp}`
  let ticketId = ''
  let unitId = ''

  // Bert (Ops) on their own phone.
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const ops = await context.newPage()

  try {
    // 1. Maya browses Back of House, then Refrigeration, to Walk-in Cooler 1.
    await signIn(page, MAYA)
    await mayaRefrigeration(page)
    await shot(page, testInfo, 'manager-browses-back-of-house')
    await unitRow(page, 'Walk-in Cooler 1').click()
    await expect(page.getByRole('heading', { name: 'Walk-in Cooler 1', level: 1 })).toBeVisible()
    const unitUrl = new URL(page.url()).pathname

    // 2. She creates a ticket from it, with the unit filled in.
    await page.getByRole('link', { name: 'Create ticket for this equipment' }).click()
    await expect(page.getByRole('heading', { name: 'New ticket' })).toBeVisible()
    await expect(
      page.getByRole('radiogroup', { name: 'Equipment' }).getByRole('radio', { name: /Walk-in Cooler 1/ }),
    ).toHaveAttribute('aria-checked', 'true')
    await shot(page, testInfo, 'form-with-unit')
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Description').fill('Reads 44°F since this morning.')
    await page.getByRole('button', { name: 'Submit ticket' }).click()
    await page
      .getByRole('dialog', { name: 'Add a photo?' })
      .getByRole('button', { name: 'Proceed without photo' })
      .click()
    await expect(page.getByRole('status').filter({ hasText: /OT-\d+ created\./ })).toBeVisible()

    // 3. The ticket shows under the unit's Tickets tab, and opens from there.
    await page.goto(unitUrl)
    await page
      .getByRole('navigation', { name: 'Equipment views' })
      .getByRole('link', { name: /Tickets/ })
      .click()
    const onUnit = page.getByRole('region', { name: 'Open tickets' }).getByRole('link', { name: new RegExp(title) })
    await expect(onUnit).toBeVisible()
    await shot(page, testInfo, 'unit-tickets-tab')
    await onUnit.click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    ticketId = new URL(page.url()).pathname.split('/').pop()!

    // 4. And on the Ops dashboard, with the unit on the ticket.
    await signIn(ops, BERT)
    const card = ops.getByRole('link', { name: new RegExp(title) })
    await expect(card).toBeVisible()
    await shot(ops, testInfo, 'ops-dashboard')
    await card.click()
    await expect(ops.getByText('Walk-in Cooler 1').first()).toBeVisible()

    // 5. Bert adds a unit at Logan Square.
    await ops.goto('/ops/equipment')
    await ops.getByRole('link', { name: 'Add equipment' }).click()
    await expect(ops.getByRole('heading', { name: 'Add equipment' })).toBeVisible()
    await ops.getByLabel('Restaurant').selectOption({ label: 'Federale’s Logan Square' })
    await expect(ops.getByRole('radio', { name: 'Back of House' })).toHaveAttribute('aria-checked', 'true')
    await ops.getByLabel('Category').selectOption({ label: 'Refrigeration' })
    await ops.getByLabel('Name').fill(unit)
    await ops.getByLabel('Brand').fill('True')
    await ops.getByLabel('Model').fill('TBB-24')
    await ops.getByRole('button', { name: 'Save equipment' }).click()
    await expect(ops).toHaveURL(/\/ops\/equipment\/[0-9a-f-]{36}$/)
    unitId = new URL(ops.url()).pathname.split('/').pop()!
    await expect(ops.getByRole('status').filter({ hasText: `${unit} added.` })).toBeVisible()

    // 6. It shows on Maya's list, under Back of House and Refrigeration, and in her picker.
    await page.goto('/tickets')
    await mayaRefrigeration(page)
    await expect(group(page, 'Refrigeration').getByRole('link', { name: new RegExp(`^${unit}`) })).toBeVisible()
    await shot(page, testInfo, 'manager-sees-new-unit')
    await page.goto('/tickets/new')
    await page.getByRole('radio', { name: 'Back of House' }).click()
    await page.getByRole('link', { name: /^Refrigeration/ }).click()
    const picker = page.getByRole('radiogroup', { name: 'Equipment' })
    await expect(picker.getByRole('radio', { name: new RegExp(unit) })).toBeVisible()

    // 7. Bert retires it.
    await ops.getByRole('link', { name: 'Edit', exact: true }).click()
    await ops.getByRole('button', { name: 'Retire this equipment' }).click()
    await ops
      .getByRole('dialog', { name: `Retire ${unit}?` })
      .getByRole('button', { name: 'Retire equipment' })
      .click()
    await expect(ops.getByRole('status').filter({ hasText: 'retired.' })).toBeVisible()

    // 8. It has left Maya's Refrigeration card and the ticket form's picker.
    await page.goto('/tickets')
    await mayaRefrigeration(page)
    await expect(unitRow(page, 'Walk-in Cooler 1')).toBeVisible()
    await expect(group(page, 'Refrigeration').getByRole('link', { name: new RegExp(`^${unit}`) })).toHaveCount(0)
    await shot(page, testInfo, 'manager-after-retire')
    await page.goto('/tickets/new')
    await page.getByRole('radio', { name: 'Back of House' }).click()
    await page.getByRole('link', { name: /^Refrigeration/ }).click()
    await expect(picker.getByRole('radio', { name: /Walk-in Cooler 1/ })).toBeVisible()
    await expect(picker.getByRole('radio', { name: new RegExp(unit) })).toHaveCount(0)
    await shot(page, testInfo, 'picker-after-retire')
  } finally {
    await context.close()
    const bert = await headers(request, BERT)
    if (ticketId) {
      await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${ticketId}`, {
        data: { status: 'closed', resolution: 'Closed by the done test' },
        headers: bert,
      })
    }
    if (unitId) {
      const deleted = await request.post(`${SUPABASE}/rest/v1/rpc/delete_equipment`, {
        headers: bert,
        data: { p_id: unitId },
      })
      expect(deleted.ok()).toBe(true)
    }
  }
})
