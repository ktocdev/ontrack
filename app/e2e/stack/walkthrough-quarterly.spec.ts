import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Walkthrough · Quarterly tasks against the seed: Ari works Ranalli's October walkthrough,
 * whose Q4 tasks are Organize utility areas (with a how-to video) and Degrease BOH floors.
 * What it marks is taken off at the end and its tickets closed (tickets are never deleted).
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const ARI = 'ari.kim@example.com'
const RANALLIS_OCT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'
const UTILITY = '99999999-9999-4999-8999-000000000001'
const FLOORS = '99999999-9999-4999-8999-000000000002'
const FIX = 'Buy a second deck brush'

async function reset(request: APIRequestContext) {
  const h = { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, ARI)}` }
  const fixes = await request.get(
    `${SUPABASE}/rest/v1/inhouse_fixes?select=id&walkthrough_id=eq.${RANALLIS_OCT}&title=eq.${encodeURIComponent(FIX)}`,
    { headers: h },
  )
  for (const { id } of (await fixes.json()) as { id: string }[]) {
    await request.post(`${SUPABASE}/rest/v1/rpc/delete_inhouse_fix`, { headers: h, data: { p_id: id } })
  }
  const tickets = await request.get(
    `${SUPABASE}/rest/v1/tickets?select=id&walkthrough_id=eq.${RANALLIS_OCT}&title=like.Floor%20drain*&status=neq.closed`,
    { headers: h },
  )
  for (const { id } of (await tickets.json()) as { id: string }[]) {
    await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${id}`, { headers: h, data: { status: 'closed' } })
  }
  for (const task of [UTILITY, FLOORS]) {
    await request.post(`${SUPABASE}/rest/v1/rpc/set_walkthrough_good`, {
      headers: h,
      data: { p_walkthrough_id: RANALLIS_OCT, p_task_id: task, p_good: false },
    })
  }
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

test('the quarter’s tasks show directions and a video, and take Good, a fix and a ticket', async ({
  page,
}, testInfo) => {
  await signIn(page, ARI)
  await page.goto('/walkthrough')
  await page.getByRole('link', { name: /^Q4 location tasks/ }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/quarterly$`))
  await expect(page.getByRole('heading', { name: 'Q4 location tasks' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Q4 tasks' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Due Dec 31')).toBeVisible()

  // The first task to do is open, with its directions and how-to video.
  const utility = page.getByRole('region', { name: 'Organize utility areas' })
  await expect(utility.getByRole('button', { name: /^Organize utility areas/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(utility.getByText(/Clear at least 3 feet in front of the electrical panel/)).toBeVisible()
  const video = utility.getByRole('link', { name: 'How-to video for Organize utility areas (opens in a new tab)' })
  await expect(video).toHaveAttribute('href', 'https://example.com/how-to/organize-utility-areas')
  await expect(video).toHaveAttribute('target', '_blank')
  await expect(utility.getByText('To do')).toBeVisible()
  await testInfo.attach('quarterly', { body: await page.screenshot(), contentType: 'image/png' })

  // Good marks it done.
  const good = utility.getByRole('group', { name: 'Organize utility areas' }).getByRole('button', { name: 'Good' })
  await good.click()
  await expect(good).toHaveAttribute('aria-pressed', 'true')
  await expect(utility.getByText('Done', { exact: true })).toBeVisible()
  await expect(page.getByText('1/2', { exact: true })).toBeVisible()

  // A fix on the second task, typed under it.
  const floors = page.getByRole('region', { name: 'Degrease BOH floors' })
  await floors.getByRole('button', { name: /^Degrease BOH floors/ }).click()
  await floors.getByRole('button', { name: 'Add in-house fix for Degrease BOH floors' }).click()
  await floors.getByRole('textbox', { name: 'In-house fix for Degrease BOH floors' }).fill(FIX)
  await floors.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(floors.getByText(FIX)).toBeVisible()
  await expect(floors.getByText(/^\d+ issues?$/)).toBeVisible()
  await expect(floors.getByRole('button', { name: 'Good' })).toHaveCount(0)

  // A ticket from a task: it has no area, so the categories of both are offered.
  await floors.getByRole('button', { name: /^(Create ticket|Add another ticket) for Degrease BOH floors/ }).click()
  const sheet = page.getByRole('dialog', { name: /ticket/ })
  await expect(sheet.getByText('Q4 tasks', { exact: true })).toBeVisible()
  await sheet.getByLabel("What's wrong?").fill(`Floor drain by the dish pit backs up ${testInfo.project.name}`)
  await sheet.getByLabel('Category').selectOption({ label: 'Back of House · Plumbing' })
  await sheet.getByRole('button', { name: 'Create ticket' }).click()
  await page.getByRole('button', { name: 'Proceed without photo' }).click()
  await expect(page.getByText(/^OT-\d+ created\. Ops has been notified\.$/)).toBeVisible()
  await expect(floors.getByRole('link', { name: /Floor drain by the dish pit backs up/ }).first()).toBeVisible()
})
