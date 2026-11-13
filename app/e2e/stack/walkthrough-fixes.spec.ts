import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Walkthrough · In-house fixes against the seed: Ari adds two fixes on Ranalli's October
 * Front of House › Envelope, which no other test reads, opens one item's from the checklist (filtered), shows them all, checks one
 * off and deletes the other. Whatever is left is deleted at the end, so the next run starts
 * clean; a fix checked off can't be deleted, so that one stays, checked off, under Closed.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const ARI = 'ari.kim@example.com'
const RANALLIS_OCT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'
const FOH = 'cccccccc-cccc-4ccc-8ccc-000000000002'
const WINDOWS = 'dddddddd-dddd-4ddd-8ddd-000000000209'
const WALLS = 'dddddddd-dddd-4ddd-8ddd-000000000210'
const MINE = 'Fixes test ·'

async function reset(request: APIRequestContext) {
  const h = { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, ARI)}` }
  const res = await request.get(
    `${SUPABASE}/rest/v1/inhouse_fixes?select=id,first_done_at&walkthrough_id=eq.${RANALLIS_OCT}&title=like.${encodeURIComponent(MINE)}*`,
    { headers: h },
  )
  for (const f of (await res.json()) as { id: string; first_done_at: string | null }[]) {
    // Once checked off a fix stays on the record, so the one this test checks off stays, closed.
    if (f.first_done_at) continue
    await request.post(`${SUPABASE}/rest/v1/rpc/delete_inhouse_fix`, { headers: h, data: { p_id: f.id } })
  }
}

async function addFix(request: APIRequestContext, itemId: string, title: string) {
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/add_walkthrough_fix`, {
    headers: { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, ARI)}` },
    data: { p_walkthrough_id: RANALLIS_OCT, p_item_id: itemId, p_title: title },
  })
  expect(res.ok(), await res.text()).toBe(true)
}

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

test('a fix opens its item’s list, which shows all, checks off and deletes', async ({ page, request }, testInfo) => {
  const run = `${testInfo.project.name} ${Date.now() % 100000}`
  const outlet = `${MINE} reseal the door ${run}`
  const light = `${MINE} patch the wall ${run}`
  await addFix(request, WINDOWS, outlet)
  await addFix(request, WALLS, light)

  // From the checklist, a fix opens the list for its item only.
  await signIn(page, ARI)
  await page.goto(`/walkthrough/${RANALLIS_OCT}/${FOH}`)
  await page.getByRole('button', { name: /^Envelope/ }).click()
  await page.getByRole('link', { name: new RegExp(outlet) }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/fixes\\?item=${WINDOWS}$`))
  await expect(page.getByRole('heading', { name: 'In-house fixes' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Showing FOH › Envelope › Windows and doors/ })).toBeVisible()
  await expect(page.getByText(outlet)).toBeVisible()
  await expect(page.getByText(light)).toHaveCount(0)
  await expect(page.getByText(/^Added today by Ari/).first()).toBeVisible()
  await testInfo.attach('fixes for an item', { body: await page.screenshot(), contentType: 'image/png' })

  // Show all lists every fix on the walkthrough, each saying where it came from.
  await page.getByRole('link', { name: /^Show all \d+$/ }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/fixes$`))
  await expect(page.getByText(light)).toBeVisible()
  await expect(page.getByText('FOH › Envelope › Walls').first()).toBeVisible()

  // Check one off: it moves under Closed and loses its delete.
  await page.getByRole('checkbox', { name: outlet }).click()
  await page.getByText(/^Closed · \d+$/).click()
  await expect(page.getByRole('checkbox', { name: outlet })).toBeChecked()
  await expect(page.getByRole('button', { name: `Delete in-house task: ${outlet}` })).toHaveCount(0)

  // Delete the other, after the confirm step.
  await page.getByRole('button', { name: `Delete in-house task: ${light}` }).click()
  await page.getByRole('dialog', { name: 'Delete this in-house task?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('In-house fix deleted.')).toBeVisible()
  await expect(page.getByText(light)).toHaveCount(0)
  await testInfo.attach('all fixes', { body: await page.screenshot(), contentType: 'image/png' })

  // Back goes to the checklist it came from. With its only fix checked off, the item offers
  // Good again and In-house is no longer lit, while the fix stays listed under it.
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/${FOH}$`))
  const windows = page.getByRole('group', { name: 'Windows and doors', exact: true })
  await expect(windows.getByRole('button', { name: 'Good' })).toBeVisible()
  await expect(windows.getByRole('button', { name: /in-house fix for Windows and doors/ })).not.toHaveClass(
    /bg-choice-inhouse-bg/,
  )
  await expect(page.getByRole('link', { name: new RegExp(outlet) })).toBeVisible()
})
