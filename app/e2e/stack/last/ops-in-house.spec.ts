import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { signIn, tokenFor } from '../helpers'

/**
 * Ops · in-house fixes and tasks (WT-Ops-Fix, OT-131) against the seed. In `last/`, since a
 * fix made into a ticket stays a ticket and a task stays on a list, which the counts in other
 * flows would notice. Bert adds two fixes to West Loop's October walkthrough (open past its
 * due day, and no other flow counts West Loop), opens one from the restaurant's page, shows
 * them all, and converts both: one whose item has a category, one whose item has none, so
 * the sheet asks. Then he adds a task at Porter from his In-house list, and Dana, Porter's
 * Reporter, sees who sent it, its unit and its note. Titles carry the run, so a second run
 * works without `db reset`.
 */

test.use({ timezoneId: 'America/Chicago' })

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const BERT = 'bert.velilla@example.com'
const DANA = 'dana.ortiz@example.com'
const WEST_LOOP_OCT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'
const PORTER = '11111111-1111-4111-8111-000000000003'

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

const headers = async (request: APIRequestContext, email: string) => ({
  apikey: KEY,
  Authorization: `Bearer ${await tokenFor(request, email)}`,
})

/** The walkthrough's items: one with a category and one without, to convert. */
async function twoItems(request: APIRequestContext) {
  const h = await headers(request, BERT)
  const w = await request.get(`${SUPABASE}/rest/v1/walkthroughs?select=template_id&id=eq.${WEST_LOOP_OCT}`, {
    headers: h,
  })
  const [{ template_id }] = (await w.json()) as { template_id: string }[]
  const res = await request.get(
    `${SUPABASE}/rest/v1/walkthrough_items?select=id,title,category_id,section:walkthrough_sections!inner(template_id)&section.template_id=eq.${template_id}&active=eq.true`,
    { headers: h },
  )
  const items = (await res.json()) as { id: string; title: string; category_id: string | null }[]
  const withCategory = items.find((i) => i.category_id)
  const without = items.find((i) => !i.category_id)
  expect(withCategory && without, 'the checklist has items with and without a category').toBeTruthy()
  return { withCategory: withCategory!, without: without! }
}

async function addFix(request: APIRequestContext, itemId: string, title: string) {
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/add_walkthrough_fix`, {
    headers: await headers(request, BERT),
    data: { p_walkthrough_id: WEST_LOOP_OCT, p_item_id: itemId, p_title: title },
  })
  expect(res.ok(), await res.text()).toBe(true)
}

test('Ops opens a walkthrough’s fixes and converts two to tickets', async ({ page, request }, testInfo) => {
  const run = `${testInfo.project.name} ${Date.now() % 100000}`
  const first = `Convert test · rewire ${run}`
  const second = `Convert test · patch ${run}`
  const { withCategory, without } = await twoItems(request)
  await addFix(request, withCategory.id, first)
  await addFix(request, without.id, second)

  // From one restaurant's page, a fix opens the walkthrough's fixes at its item.
  await signIn(page, BERT)
  await page.goto(`/ops/walkthroughs/${WEST_LOOP_OCT}`)
  await page.getByRole('link', { name: new RegExp(first) }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/walkthroughs/${WEST_LOOP_OCT}/fixes\\?item=${withCategory.id}$`))
  await expect(page.getByRole('heading', { name: 'In-house fixes' })).toBeVisible()
  await expect(page.getByText('October walkthrough · Federale’s West Loop')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Showing .* Clear the filter$/ })).toBeVisible()
  await expect(page.getByText(first)).toBeVisible()
  await expect(page.getByText(second)).toHaveCount(0)
  await expect(page.getByText('The restaurant team checks these off.', { exact: false })).toBeVisible()
  await shot(page, testInfo, 'ops fixes · one item')

  // Show all, then convert the one whose item has a category: no question asked.
  await page.getByRole('link', { name: /^Show all \d+$/ }).click()
  await expect(page.getByText(second)).toBeVisible()
  await page.getByRole('button', { name: `Convert to ticket: ${first}` }).click()
  const sheet = page.getByRole('dialog', { name: 'Convert to a ticket?' })
  await expect(sheet).toContainText('tagged Walkthrough')
  await expect(sheet.getByLabel('Category')).toHaveCount(0)
  await shot(page, testInfo, 'ops fixes · convert sheet')
  await sheet.getByRole('button', { name: 'Convert to ticket' }).click()
  await expect(sheet).toBeHidden()
  const notice = page.getByRole('status').filter({ hasText: /^Converted to OT-\d+\. It’s on your dashboard\.$/ })
  await expect(notice).toBeVisible()
  const firstId = (await notice.textContent())!.match(/OT-\d+/)![0]
  await expect(page.getByRole('button', { name: `Convert to ticket: ${first}` })).toHaveCount(0)
  await expect(page.getByRole('link', { name: `Open ticket ${firstId}` })).toBeVisible()

  // The one without a category asks for one.
  await page.getByRole('button', { name: `Convert to ticket: ${second}` }).click()
  await sheet.getByRole('button', { name: 'Convert to ticket' }).click()
  await expect(sheet.getByText('Pick a category for the ticket.')).toBeVisible()
  await sheet.getByLabel('Category').selectOption({ index: 1 })
  await sheet.getByRole('button', { name: 'Convert to ticket' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: /^Converted to OT-\d+\./ })).toBeVisible()
  await expect(page.getByRole('button', { name: `Convert to ticket: ${second}` })).toHaveCount(0)
  await shot(page, testInfo, 'ops fixes · converted')

  // The ticket is a walkthrough ticket with nobody on it.
  await page.getByRole('link', { name: `Open ticket ${firstId}` }).click()
  await expect(page).toHaveURL(/\/ops\/tickets\//)
  await expect(page.getByRole('heading', { name: first })).toBeVisible()
  await expect(page.getByText('From October walkthrough')).toBeVisible()
  await expect(page.getByText('Nobody yet')).toBeVisible()

  // Back on the restaurant's page, it is flagged as a ticket, not in-house.
  await page.goto(`/ops/walkthroughs/${WEST_LOOP_OCT}`)
  await expect(page.getByRole('link', { name: new RegExp(firstId) })).toBeVisible()
})

test('Ops adds a task at Porter, and its Reporter sees who sent it, its unit and note', async ({
  browser,
  page,
  request,
}, testInfo) => {
  const run = `${testInfo.project.name} ${Date.now() % 100000}`
  const title = `Ops task · replace the bulb ${run}`
  const note = `It’s the 2-pin kind, spares are in the office (${run}).`

  // The In-house list opens from the dashboard's menu.
  await signIn(page, BERT)
  await page.goto('/ops')
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await page.getByRole('menuitem', { name: 'In-house tasks' }).click()
  await expect(page).toHaveURL(/\/ops\/in-house$/)
  await expect(page.getByRole('heading', { name: 'In-house tasks' })).toBeVisible()

  // At Porter, add a task with a note and a unit.
  await page.goto(`/ops/in-house?restaurant=${PORTER}`)
  await expect(page.getByText('Porter', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add in-house task' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add in-house task' })
  await sheet.getByLabel('Task').fill(title)
  await sheet.getByLabel(/^Note/).fill(note)
  const unit = sheet.getByLabel(/^Unit/)
  await unit.selectOption({ index: 1 })
  const unitName = (await unit.locator('option:checked').textContent())!.trim()
  await expect(sheet.getByText('The task takes the unit’s category and area.')).toBeVisible()
  await shot(page, testInfo, 'ops in-house · add task')
  await sheet.getByRole('button', { name: 'Add task' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: /^Task added\./ })).toBeVisible()
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByRole('button', { name: `Convert to ticket: ${title}` })).toBeVisible()
  await shot(page, testInfo, 'ops in-house · task added')

  // Dana, at Porter, has it on her In-house list with who sent it, the unit and the note.
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, DANA)
  await dana.goto('/tickets/in-house')
  await expect(dana.getByText(title)).toBeVisible()
  await expect(dana.getByText(note)).toBeVisible()
  const row = dana.locator('label').filter({ hasText: title })
  await expect(row.getByText(new RegExp(`^From Bert · \\w{3} \\d+ · ${unitName}$`))).toBeVisible()
  await testInfo.attach('manager in-house · task from ops', { body: await dana.screenshot(), contentType: 'image/png' })

  // Notify now shows to a Reporter on My categories.
  await dana.goto('/profile/categories')
  await expect(dana.getByText(/tasks from the .* notify you/)).toBeVisible()
  await context.close()

  // And Dana was sent it, by email at least (she has no push subscription here).
  const fix = await request.get(
    `${SUPABASE}/rest/v1/inhouse_fixes?select=id&restaurant_id=eq.${PORTER}&title=eq.${encodeURIComponent(title)}`,
    { headers: await headers(request, BERT) },
  )
  const [{ id }] = (await fix.json()) as { id: string }[]
  const danaHeaders = await headers(request, DANA)
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${SUPABASE}/rest/v1/notification_deliveries?select=kind,channel&inhouse_fix_id=eq.${id}`,
          { headers: danaHeaders },
        )
        return ((await res.json()) as { kind: string; channel: string }[]).map((r) => `${r.kind}:${r.channel}`)
      },
      { timeout: 20_000, intervals: [500] },
    )
    .toContain('inhouse_task:email')
})
