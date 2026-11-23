import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { openRestaurants, signIn } from '../helpers'

/**
 * Phase 6's done test as one flow: next month's walkthrough is opened by the database for
 * all four restaurants, a manager submits one from a phone with two tickets and one fix,
 * those tickets show the Walkthrough tag on the Ops dashboard (6a), and the Ops overview
 * shows one of four submitted (6b, OT-139).
 *
 * The seed's newest walkthroughs are October's, so "next month" is November 2026, opened by
 * `open_walkthroughs`, which runs only for the scheduled job; the test calls it with the
 * stack's secret key (STACK_SECRET_KEY), as `pg_cron` would. Opening it makes November every
 * restaurant's current walkthrough, which the other walkthrough flows don't expect, so this
 * file runs in the `*-last` projects, after the rest of its browser's suite (see
 * playwright.stack.config.ts). Submitting can't be undone, so each browser takes its own
 * restaurant: Maya at Logan Square on Chromium, Dana at Porter on WebKit. A second run needs
 * `supabase db reset` first. CI runs each browser on its own stack, so each sees one of four
 * submitted; here both share one, and the second to run sees two.
 */

test.use({ timezoneId: 'America/Chicago' })

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SECRET = process.env.STACK_SECRET_KEY ?? ''
const NOVEMBER = '2026-11-01'
const BERT = 'bert.velilla@example.com'
// November is month A of the group's rotation (OT-126), Kitchen + Exterior.
const KITCHEN = 'cccccccc-cccc-4ccc-8ccc-000000000003'
const RESTAURANTS = {
  logan: '11111111-1111-4111-8111-000000000001',
  westLoop: '11111111-1111-4111-8111-000000000002',
  porter: '11111111-1111-4111-8111-000000000003',
  ranallis: '11111111-1111-4111-8111-000000000004',
}
const MANAGER = {
  chromium: { email: 'maya.reyes@example.com', restaurant: RESTAURANTS.logan, name: 'Federale’s Logan Square' },
  webkit: { email: 'dana.ortiz@example.com', restaurant: RESTAURANTS.porter, name: 'Porter' },
}

/** A call as the service role, which is what the scheduled job runs as. */
async function service(request: APIRequestContext, path: string, data?: object) {
  const headers = { apikey: SECRET, 'Content-Type': 'application/json' }
  const res = data
    ? await request.post(`${SUPABASE}/rest/v1/${path}`, { headers, data })
    : await request.get(`${SUPABASE}/rest/v1/${path}`, { headers })
  expect(res.ok(), await res.text()).toBe(true)
  return res.json()
}

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}
const choices = (page: Page, name: string) => page.getByRole('group', { name, exact: true })

/** Quick ticket from an item on the checklist, without a photo. */
async function ticketFrom(page: Page, item: string, title: string, urgent = false) {
  await choices(page, item)
    .getByRole('button', { name: `Create ticket for ${item}` })
    .click()
  const sheet = page.getByRole('dialog', { name: 'Create ticket' })
  await expect(sheet.getByText(item, { exact: true })).toBeVisible()
  await sheet.getByLabel("What's wrong?").fill(title)
  if (urgent) await sheet.getByRole('radio', { name: 'Urgent' }).click()
  await sheet.getByRole('button', { name: 'Create ticket' }).click()
  await page.getByRole('button', { name: 'Proceed without photo' }).click()
  await expect(page.getByText(/^OT-\d+ created\. Ops has been notified\.$/).last()).toBeVisible()
}

test('next month opens for every restaurant, a manager submits it with two tickets and a fix, Ops sees them tagged and one of four submitted', async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000)
  expect(SECRET, 'STACK_SECRET_KEY is the local stack’s SECRET_KEY from `supabase status -o env`').not.toBe('')
  const manager = MANAGER[testInfo.project.use.defaultBrowserType === 'webkit' ? 'webkit' : 'chromium']
  const stamp = Date.now() % 1_000_000
  const outlet = `Outlet by the dish pit is loose ${stamp}`
  const bulbs = `Two bulbs out over the line ${stamp}`
  const fix = `Re-seat the mixer plug ${stamp}`
  const note = 'Front of House next week, short-staffed'

  // 1. The database opens November for all four restaurants, from their rotations, due on its
  //    last day. Safe to repeat, so the other browser's run may already have opened it.
  await service(request, 'rpc/open_walkthroughs', { p_period: NOVEMBER })
  const opened = (await service(
    request,
    `walkthroughs?select=id,restaurant_id,due_on,status&period=eq.${NOVEMBER}`,
  )) as { id: string; restaurant_id: string; due_on: string; status: string }[]
  for (const id of Object.values(RESTAURANTS)) {
    expect(opened.filter((w) => w.restaurant_id === id).map((w) => w.due_on)).toEqual(['2026-11-30'])
  }
  const mine = opened.find((w) => w.restaurant_id === manager.restaurant)!
  expect(mine.status).toBe('open')

  // 2. The manager, on a phone, finds November on the walkthrough home.
  await signIn(page, manager.email)
  await page.goto('/walkthrough')
  await expect(page.getByText(/November/).first()).toBeVisible()
  await shot(page, testInfo, 'home · November')
  await page.getByRole('link', { name: /^Kitchen/ }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${mine.id}/${KITCHEN}$`))
  await expect(page.getByText(`November walkthrough · ${manager.name}`)).toBeVisible()

  // 3. Walking Electrical: two items Good, one in-house fix, two tickets.
  for (const item of ['Emergency lights and signs', 'Feature']) {
    await choices(page, item).getByRole('button', { name: 'Good' }).click()
    await expect(choices(page, item).getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'true')
  }
  await choices(page, 'Appliances (plugs, etc.)')
    .getByRole('button', { name: 'Add in-house fix for Appliances (plugs, etc.)' })
    .click()
  await page.getByRole('textbox', { name: 'In-house fix for Appliances (plugs, etc.)' }).fill(fix)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(fix)).toBeVisible()

  await ticketFrom(page, 'Outlets', outlet)
  await expect(page.getByRole('link', { name: new RegExp(outlet) })).toBeVisible()
  await ticketFrom(page, 'Light bulbs', bulbs, true)
  // Every item has something now, so the group closes and hands on to Plumbing.
  const electrical = page.getByRole('button', { name: /^Electrical 5\/5/ })
  await expect(electrical).toHaveAttribute('aria-expanded', 'false')
  await expect(electrical).toContainText(/2 tickets\s*1 in-house/)
  await electrical.click()
  await expect(page.getByRole('link', { name: new RegExp(bulbs) })).toContainText('URGENT')
  await shot(page, testInfo, 'checklist · Electrical')

  // 4. Review shows the two tickets and the fix; submitting early asks first.
  await page.goto('/walkthrough')
  await page.getByRole('link', { name: 'Review & submit' }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${mine.id}/review$`))
  await expect(page.getByRole('link', { name: '1 in-house fix to do, view and manage all' })).toBeVisible()
  await expect(page.getByRole('link', { name: '2 open tickets, view and edit all' })).toBeVisible()
  await page.getByLabel(/Note for Ops/).fill(note)
  await shot(page, testInfo, 'review')
  await page.getByRole('button', { name: 'Submit walkthrough' }).click()
  await page.getByRole('button', { name: 'Submit anyway' }).click()
  await expect(page.getByText('November walkthrough submitted.')).toBeVisible()
  await expect(page).toHaveURL(/\/walkthrough$/)
  await shot(page, testInfo, 'home · submitted')

  // The database has it submitted with the note, two walkthrough tickets and one fix.
  const [done] = (await service(request, `walkthroughs?select=status,submitted_note&id=eq.${mine.id}`)) as {
    status: string
    submitted_note: string
  }[]
  expect(done).toEqual({ status: 'submitted', submitted_note: note })
  const tickets = (await service(
    request,
    `tickets?select=title,source,urgency&walkthrough_id=eq.${mine.id}&order=title`,
  )) as { title: string; source: string; urgency: string }[]
  expect(tickets).toEqual([
    { title: outlet, source: 'walkthrough', urgency: 'normal' },
    { title: bulbs, source: 'walkthrough', urgency: 'urgent' },
  ])
  const fixes = (await service(request, `inhouse_fixes?select=title&walkthrough_id=eq.${mine.id}`)) as {
    title: string
  }[]
  expect(fixes).toEqual([{ title: fix }])

  // 5. Bert (Ops), on his own phone, sees both under the restaurant with the Walkthrough tag.
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const ops = await context.newPage()
  try {
    await signIn(ops, BERT)
    await openRestaurants(ops)
    const group = ops.getByRole('region', { name: manager.name, exact: true })
    for (const title of [outlet, bulbs]) {
      await expect(group.getByRole('link', { name: new RegExp(title) })).toContainText('Walkthrough')
    }
    await expect(group.getByRole('link', { name: new RegExp(bulbs) })).toContainText('URGENT')
    await group.getByRole('link', { name: new RegExp(bulbs) }).scrollIntoViewIfNeeded()
    await shot(ops, testInfo, 'ops dashboard')

    // 6. Bert's Walkthroughs overview opens on November: one of four submitted, this
    //    restaurant's row submitted with its two tickets and the fix, the others still open.
    const submitted = (await service(
      request,
      `walkthroughs?select=restaurant_id&period=eq.${NOVEMBER}&status=eq.submitted`,
    )) as { restaurant_id: string }[]
    expect(submitted.map((w) => w.restaurant_id)).toContain(manager.restaurant)
    if (process.env.CI) expect(submitted).toHaveLength(1)
    await ops.getByRole('link', { name: 'Walkthroughs' }).click()
    await expect(ops).toHaveURL(/\/ops\/walkthroughs$/)
    await expect(ops.getByText('November 2026')).toBeVisible()
    // The group's Kitchen + Exterior, and Ranalli's own rotation is on Dining + Patio.
    await expect(ops.getByText('2 checklists · due Nov 30')).toBeVisible()
    await expect(ops.getByText(new RegExp(`^${submitted.length} of 4 submitted`))).toBeVisible()
    const rows = ops.getByRole('link', { name: /, \d+ of \d+$/ })
    await expect(rows).toHaveCount(4)
    const row = ops.getByRole('link', { name: new RegExp(`^${manager.name}, `) })
    await expect(row).toContainText(/Submitted \w{3} \d+/)
    await expect(row).toContainText(/2 tickets\s*1 in-house/)
    for (const [name, id] of Object.entries(RESTAURANTS)) {
      if (submitted.some((w) => w.restaurant_id === id)) continue
      const other = (await service(request, `restaurants?select=name&id=eq.${id}`)) as { name: string }[]
      expect(other, name).toHaveLength(1)
      await expect(ops.getByRole('link', { name: new RegExp(`^${other[0].name}, `) })).not.toContainText('Submitted')
    }
    await shot(ops, testInfo, 'ops walkthroughs · November')
  } finally {
    await context.close()
  }
})
