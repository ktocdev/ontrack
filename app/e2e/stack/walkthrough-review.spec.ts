import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Walkthrough · Review & submit against the seed: Ari's Ranalli's October walkthrough,
 * with checks still to do. Submitting can't be undone and every open walkthrough in the
 * seed is another flow's, so the submit call itself is answered here and checked for what
 * it sends; the database's side of submitting is pgTAP's (43_walkthroughs).
 */

const ARI = 'ari.kim@example.com'
const RANALLIS_OCT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
// Front of House › Envelope › Floors, which names no category, so the ticket takes Decorations.
const FLOORS = 'dddddddd-dddd-4ddd-8ddd-000000000211'
const DECORATIONS = '33333333-3333-4333-8333-000000000004'
const MINE = 'Review test ·'

async function call(request: APIRequestContext, name: string, data: object) {
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/${name}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, ARI)}` },
    data,
  })
  expect(res.ok(), await res.text()).toBe(true)
}

/** Closes this test's tickets and deletes its fixes, so only what a run makes is open. */
async function reset(request: APIRequestContext) {
  const h = { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, ARI)}` }
  const like = `title=like.${encodeURIComponent(MINE)}*`
  const tickets = await request.get(
    `${SUPABASE}/rest/v1/tickets?select=id&walkthrough_id=eq.${RANALLIS_OCT}&${like}&status=neq.closed`,
    { headers: h },
  )
  for (const { id } of (await tickets.json()) as { id: string }[]) {
    await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${id}`, { headers: h, data: { status: 'closed' } })
  }
  const fixes = await request.get(
    `${SUPABASE}/rest/v1/inhouse_fixes?select=id&walkthrough_id=eq.${RANALLIS_OCT}&${like}&first_done_at=is.null`,
    { headers: h },
  )
  for (const { id } of (await fixes.json()) as { id: string }[]) {
    await request.post(`${SUPABASE}/rest/v1/rpc/delete_inhouse_fix`, { headers: h, data: { p_id: id } })
  }
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

test('review shows what is left and where, opens its lists, and asks before submitting early', async ({
  page,
  request,
}, testInfo) => {
  // One fix and one ticket still open. Other flows leave only closed ones here, which the
  // counts leave out (from feedback: a fix checked off is no longer one to do).
  const ticket = `${MINE} warped threshold ${testInfo.project.name} ${Date.now() % 100000}`
  await call(request, 'add_walkthrough_fix', {
    p_walkthrough_id: RANALLIS_OCT,
    p_item_id: FLOORS,
    p_title: `${MINE} sweep under the host stand`,
  })
  await call(request, 'create_walkthrough_ticket', {
    p_walkthrough_id: RANALLIS_OCT,
    p_item_id: FLOORS,
    p_title: ticket,
    p_category_id: DECORATIONS,
  })

  let sent: unknown = null
  await page.route('**/rest/v1/rpc/submit_walkthrough', async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({ status: 204, body: '' })
  })

  await signIn(page, ARI)
  await page.goto('/walkthrough')
  await page.getByRole('link', { name: 'Review & submit' }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/review$`))
  await expect(page.getByRole('heading', { name: 'Review & submit' })).toBeVisible()

  // Checks still to do: the warning, the counts, and where they are.
  await expect(page.getByText(/^\d+ of 50 checks are still to do\.$/)).toBeVisible()
  await expect(page.getByText(/^Still to do · \d+$/)).toBeVisible()
  const boh = page.getByRole('link', { name: /^Back of House\s*\d+ left$/ })
  await expect(boh).toBeVisible()
  await expect(page.getByRole('link', { name: '1 in-house fix to do, view and manage all' })).toBeVisible()
  await expect(page.getByRole('link', { name: '1 open ticket, view and edit all' })).toBeVisible()
  // The ticket is listed by its item, with where it came from.
  // An earlier run's ticket, closed, opens its own page; the open one opens its Edit ticket.
  await expect(
    page.locator(`a[href^="/walkthrough/${RANALLIS_OCT}/"][href*="/ticket/"]`, {
      hasText: /^Floors\s*OT-\d+ · FOH › Envelope/,
    }),
  ).toBeVisible()
  await testInfo.attach('review', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  // The Tickets count opens every ticket, and back again.
  await page.getByRole('link', { name: /open tickets?, view and edit all/ }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/tickets$`))
  await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible()
  await expect(page.getByText(/^Tickets created · \d+$/)).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(ticket) })).toContainText('FOH › Envelope › Floors')
  await page.getByRole('link', { name: 'Back to review' }).click()

  // The In-house count opens the fixes, whose Back returns here.
  await page.getByRole('link', { name: /in-house (fix|fixes) to do, view and manage all/ }).click()
  await expect(page.getByRole('heading', { name: 'In-house fixes' })).toBeVisible()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/review$`))

  // Submitting early asks first; Keep going stays.
  await page.getByLabel(/Note for Ops/).fill('Short-staffed this week, will finish FOH next walkthrough')
  await page.getByRole('button', { name: 'Submit walkthrough' }).click()
  const sheet = page.getByRole('dialog', { name: /checks? (is|are) still to do/ })
  await expect(sheet.getByText(/^Back of House\s*\d+ left$/)).toBeVisible()
  // Let the sheet finish sliding up before the picture.
  await expect(sheet.getByRole('button', { name: 'Keep going' })).toBeInViewport()
  await page.waitForTimeout(300)
  await testInfo.attach('submit early', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Keep going' }).click()
  await expect(sheet).toHaveCount(0)
  expect(sent).toBeNull()

  // Submit anyway sends the note, then goes home and says so.
  await page.getByRole('button', { name: 'Submit walkthrough' }).click()
  await page.getByRole('button', { name: 'Submit anyway' }).click()
  await expect(page.getByText('October walkthrough submitted.')).toBeVisible()
  await expect(page).toHaveURL(/\/walkthrough$/)
  expect(sent).toEqual({
    p_walkthrough_id: RANALLIS_OCT,
    p_note: 'Short-staffed this week, will finish FOH next walkthrough',
  })
})

test('a still-to-do part opens its checklist', async ({ page }) => {
  await signIn(page, ARI)
  await page.goto(`/walkthrough/${RANALLIS_OCT}/review`)
  await page.getByRole('link', { name: /^Front of House\s*\d+ left$/ }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/cccccccc-cccc-4ccc-8ccc-000000000002$`))
})
