import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test'
import { openRestaurants, signIn } from '../helpers'

/**
 * Phase 7's done test as one flow (the seeded half; the group's real spreadsheet is tried by
 * hand on the live app). Bert imports a contractor sheet on his phone with a new contractor,
 * a row that needs a fix and one already in OnTrack, which he updates; the done screen counts
 * them and the directory shows them. Lee opens the Overview on a laptop and sees the open and
 * urgent tickets Bert's dashboard shows. Then the imported contractor does a job: Maya
 * reports it, Bert logs the visit and closes the ticket, and Lee's Spend for the month rises
 * by the same amount as Bert's Invoices and Closed tickets for the month, with Open still
 * matching. The three months count different things (Spend is every visit, Invoices leaves
 * in-house work out, Closed counts closed tickets by when they closed; decided Nov 19, 2026),
 * so the visit is what they must agree on.
 *
 * Under last/: it adds contractors, a visit and a closed ticket that the other flows' counts
 * don't expect. Names carry the run, so both browsers can run it on one stack.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'
const MAYA = 'maya.reyes@example.com'
const LEE = 'lee.chen@example.com'
const COOLER = '44444444-4444-4444-8444-000000000001'
const METRO = '55555555-5555-4555-8555-000000000011'
const VISIT_CENTS = 23425

const zone = { timeZone: 'America/Chicago' } as const
const now = new Date()
const MONTH = now.toLocaleDateString('en-US', { ...zone, month: 'long' })
const MONTH_YEAR = now.toLocaleDateString('en-US', { ...zone, month: 'long', year: 'numeric' })

const cents = (text: string) => {
  const m = text.match(/\$([\d,]+\.\d{2})/)
  return m ? Math.round(Number(m[1]!.replace(/,/g, '')) * 100) : 0
}
const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
}

/** Another person on their own device: Maya's phone, or Lee's laptop. */
async function device(browser: Browser, testInfo: TestInfo, viewport?: { width: number; height: number }) {
  const use = testInfo.project.use
  const context = await browser.newContext({
    baseURL: use.baseURL,
    storageState: use.storageState,
    timezoneId: 'America/Chicago',
    ...(viewport ? { viewport } : { viewport: use.viewport, userAgent: use.userAgent, isMobile: use.isMobile }),
  })
  return { context, page: await context.newPage() }
}

/** A figure tile on leadership's Overview, by its label. */
const tile = (page: Page, label: string | RegExp): Locator =>
  page
    // Open tickets and Urgent are links since OT-175, the rest boxes.
    .locator('div, a')
    .filter({ has: page.getByText(label, { exact: true }) })
    .last()

/** Lee's Overview for this month: open and urgent now, and the month's spend. */
async function overview(lee: Page) {
  await lee.goto('/lead')
  await expect(lee.getByText('READ-ONLY VIEW')).toHaveCount(0)
  await expect(lee.getByText(MONTH_YEAR).first()).toBeVisible()
  const open = tile(lee, 'Open tickets')
  await expect(open).toContainText(/\d/)
  return {
    open: Number((await open.innerText()).match(/\d+/)![0]),
    urgent: Number((await tile(lee, 'Urgent').innerText()).match(/\d+/)![0]),
    spend: cents(await tile(lee, `Spend · ${MONTH}`).innerText()),
  }
}

/** Bert's dashboard, every restaurant: each restaurant's open count (OT-168's rows), and the urgent cards. */
async function dashboard(page: Page) {
  await page.goto('/ops')
  await expect(page.getByText(/All restaurants \(\d+\)/)).toBeVisible()
  await expect(page.getByRole('link', { name: /OT-\d+/ }).first()).toBeVisible()
  // A closed row still shows every urgent card, so both read the same open or closed.
  const rows = await page
    .locator('section > h2 > button')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  const open = rows.reduce((n, label) => n + Number(label.match(/, (\d+) open/)?.[1] ?? 0), 0)
  const urgent = (await page.getByRole('link', { name: /OT-\d+/ }).allTextContents()).filter((t) =>
    t.includes('URGENT'),
  ).length
  return { open, urgent }
}

/** Bert's Invoices and Closed tickets for this month, every restaurant. */
async function months(page: Page) {
  await page.goto('/ops/contractors/invoices')
  const month = page.getByRole('button', { name: /^Month: / })
  const count = page.getByText(/^\d+ invoices?$/)
  // Read once the visits have loaded, since the month is picked from them. With no visit yet
  // this month the tab opens on its newest month with one, so this month counts none.
  await expect(count).toBeVisible()
  await expect(page.getByLabel('Loading invoices')).toHaveCount(0)
  const invoices =
    (await month.getAttribute('aria-label')) === `Month: ${MONTH_YEAR}`
      ? cents(await count.locator('xpath=following-sibling::span').innerText())
      : 0

  await page.goto('/ops/closed')
  await expect(page.getByRole('heading', { name: 'Closed tickets' })).toBeVisible()
  await expect(page.getByLabel('Loading closed tickets')).toHaveCount(0)
  await expect(page.getByRole('region').or(page.getByText('Nothing closed this month')).first()).toBeVisible()
  const region = page.getByRole('region', { name: MONTH, exact: true })
  const closed = (await region.count()) ? cents(await region.locator('h2 + span').innerText()) : 0
  return { invoices, closed }
}

test('Bert imports the contractor sheet, and Lee’s Overview shows what Ops sees', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(240_000)
  const r = `${testInfo.project.name.startsWith('webkit') ? 'W' : 'C'}${Date.now() % 1_000_000}`
  const lakeshore = `Lakeshore Electric ${r}`
  const arctic = `Arctic Air ${r}`
  const title = `Outlet by the walk-in sparks ${r}`
  const csv = [
    'Vendor,Type,Contact,Cell,Email,Notes',
    `${lakeshore},Electrical,Dana Kim,(312) 555-0141,dana@lakeshore.example.com,`,
    `${arctic},Refrig.,Al Frost,(312) 555-0142,,`,
    `metro lighting,,,(312) 555-0199,,Done test ${r}`,
  ].join('\n')

  // 1. Bert imports the sheet from Contractors' menu.
  await signIn(page, BERT)
  await page.goto('/ops/contractors')
  await page.getByRole('button', { name: 'More options for contractors' }).click()
  await page.getByRole('menuitem', { name: 'Import from a spreadsheet' }).click()
  await page
    .getByLabel('Spreadsheet to import')
    .setInputFiles({ name: 'Vendors.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByText('3 rows · 6 columns · first sheet')).toBeVisible()
  await page.getByRole('button', { name: 'Next: match columns' }).click()
  await expect(page.getByRole('heading', { name: 'Match columns' })).toBeVisible()
  await shot(page, testInfo, 'match columns')
  await page.getByRole('button', { name: 'Next: review rows' }).click()

  // Review: "Refrig." needs a fix; Metro Lighting is already in OnTrack, so Bert updates it.
  await expect(page.getByRole('heading', { name: 'Review 3 rows' })).toBeVisible()
  const refrig = page.getByRole('region', { name: '“Refrig.” isn’t a trade' })
  await expect(refrig.getByRole('combobox')).toHaveValue('Refrigeration')
  await refrig.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('region', { name: 'Metro Lighting' }).getByRole('radio', { name: 'Update existing' }).click()
  await shot(page, testInfo, 'review')
  await page.getByRole('button', { name: 'Import 3 contractors' }).click()

  await expect(page.getByRole('heading', { name: '3 contractors imported' })).toBeVisible()
  await expect(page.getByText(/^Added\s*2$/)).toBeVisible()
  await expect(page.getByText(/^Updated\s*1$/)).toBeVisible()
  await shot(page, testInfo, 'done')

  // The directory shows them, and Undo is offered for 24 hours.
  await page.getByRole('link', { name: 'View contractors' }).click()
  await expect(page.getByText(/You imported 3 contractors from Vendors\.csv/)).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search contractors' }).fill(r)
  await expect(page.getByRole('article', { name: lakeshore })).toContainText('Electrical')
  await expect(page.getByRole('article', { name: arctic })).toContainText('Refrigeration')
  await page.goto(`/ops/contractors/${METRO}`)
  await expect(page.getByText(`Done test ${r}`)).toBeVisible()
  await expect(page.getByText('(312) 555-0199').first()).toBeVisible()
  await shot(page, testInfo, 'updated contractor')

  // 2. Lee on a laptop sees the open and urgent tickets Bert's dashboard shows.
  const lee = await device(browser, testInfo, { width: 1280, height: 800 })
  const maya = await device(browser, testInfo)
  try {
    await signIn(lee.page, LEE)
    const ops = await dashboard(page)
    const before = await overview(lee.page)
    expect(before.open, 'Open tickets, as on Bert’s dashboard').toBe(ops.open)
    expect(before.urgent, 'Urgent, as on Bert’s dashboard').toBe(ops.urgent)
    await shot(lee.page, testInfo, 'overview on a laptop')
    const opsBefore = await months(page)

    // 3. Maya reports a problem; Bert logs the imported contractor's visit and closes it.
    await signIn(maya.page, MAYA)
    await maya.page.goto(`/equipment/${COOLER}`)
    await maya.page.getByRole('link', { name: 'Create ticket for this equipment' }).click()
    await maya.page.getByLabel('Title').fill(title)
    await maya.page.getByLabel('Description').fill('The outlet behind the walk-in sparks when the compressor starts.')
    await maya.page.getByRole('button', { name: 'Submit ticket' }).click()
    await maya.page
      .getByRole('dialog', { name: 'Add a photo?' })
      .getByRole('button', { name: 'Proceed without photo' })
      .click()
    await expect(maya.page.getByRole('status').filter({ hasText: /OT-\d+ created\./ })).toBeVisible()

    expect((await overview(lee.page)).open, 'the new ticket is open for Lee').toBe(before.open + 1)
    expect((await dashboard(page)).open, 'and on Bert’s dashboard').toBe(ops.open + 1)

    await openRestaurants(page)
    await page.getByRole('link', { name: new RegExp(title) }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await page.getByRole('region', { name: 'Service & cost' }).getByRole('link', { name: '+ Log service' }).click()
    await expect(page.getByRole('heading', { name: 'Log service' })).toBeVisible()
    await page.getByLabel('Contractor company').selectOption({ label: lakeshore })
    await page.getByLabel('Technician').fill('Dana Kim')
    await page.getByLabel('Invoice #').fill(`LE-${r}`)
    await page.getByLabel('Labor', { exact: true }).fill('150')
    await page.getByLabel('Parts', { exact: true }).fill('84.25')
    await expect(page.getByText('$234.25')).toBeVisible()
    await page.getByLabel('Work notes').fill('Replaced the outlet and its box; the circuit tests clean.')
    await page.getByRole('button', { name: 'Save to ticket & equipment' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Service logged.' })).toBeVisible()

    await page.getByRole('button', { name: /^Status/ }).click()
    await page.getByRole('menuitem', { name: 'Close ticket' }).click()
    const sheet = page.getByRole('dialog', { name: /^Close OT-\d+\?$/ })
    await sheet.getByLabel('Comment').fill('Lakeshore replaced the outlet.')
    await sheet.getByRole('button', { name: 'Close ticket' }).click()
    await expect(page.getByRole('status').filter({ hasText: /OT-\d+ closed\./ })).toBeVisible()

    // 4. The visit raised Lee's Spend, Bert's Invoices and Closed tickets by the same amount,
    // and Lee's Open and Urgent are still Bert's.
    const after = await overview(lee.page)
    const opsAfter = await months(page)
    const opsNow = await dashboard(page)
    expect(after.spend - before.spend, 'Lee’s Spend for the month').toBe(VISIT_CENTS)
    expect(opsAfter.invoices - opsBefore.invoices, 'Bert’s Invoices for the month').toBe(VISIT_CENTS)
    expect(opsAfter.closed - opsBefore.closed, 'Bert’s Closed tickets for the month').toBe(VISIT_CENTS)
    expect(after.open).toBe(opsNow.open)
    expect(after.open).toBe(before.open)
    expect(after.urgent).toBe(opsNow.urgent)
    await shot(lee.page, testInfo, 'overview after the visit')
  } finally {
    await lee.context.close()
    await maya.context.close()
  }
})
