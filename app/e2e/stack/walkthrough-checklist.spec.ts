import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Manager · Walkthrough checklist against the seed: Ari works Ranalli's October
 * walkthrough, Back of House. Each tap saves at once; a group that fills closes and the
 * next opens; In-house opens a field under the item. Everything it marks is taken off
 * again at the end, so no other flow's counts move.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const ARI = 'ari.kim@example.com'
const RANALLIS_OCT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'
const BOH = 'cccccccc-cccc-4ccc-8ccc-000000000001'
const item = (n: number) => `dddddddd-dddd-4ddd-8ddd-${String(100 + n).padStart(12, '0')}`
const FIX = 'Swap the cracked cover plate'

async function headers(request: APIRequestContext) {
  return { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, ARI)}` }
}

/** Puts Ranalli's Electrical back as the seed has it: nothing Good, no fix. */
async function reset(request: APIRequestContext) {
  const h = await headers(request)
  const fixes = await request.get(
    `${SUPABASE}/rest/v1/inhouse_fixes?select=id&walkthrough_id=eq.${RANALLIS_OCT}&title=eq.${encodeURIComponent(FIX)}`,
    { headers: h },
  )
  for (const { id } of (await fixes.json()) as { id: string }[]) {
    await request.post(`${SUPABASE}/rest/v1/rpc/delete_inhouse_fix`, { headers: h, data: { p_id: id } })
  }
  for (const n of [1, 2, 3, 4, 5]) {
    await request.post(`${SUPABASE}/rest/v1/rpc/set_walkthrough_good`, {
      headers: h,
      data: { p_walkthrough_id: RANALLIS_OCT, p_item_id: item(n), p_good: false },
    })
  }
}

const choices = (page: Page, name: string) => page.getByRole('group', { name, exact: true })
const group = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name} \\d+/\\d+`) })

test.beforeEach(async ({ request }) => reset(request))
test.afterEach(async ({ request }) => reset(request))

test('a manager marks items as they walk, and a full group hands on to the next', async ({ page }, testInfo) => {
  await signIn(page, ARI)
  await page.goto('/walkthrough')
  await page.getByRole('link', { name: /^Back of House/ }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/${BOH}$`))
  await expect(page.getByRole('heading', { name: 'Back of House' })).toBeVisible()
  await expect(page.getByText('October walkthrough · Ranalli’s Logan Square')).toBeVisible()
  await expect(page.getByRole('link', { name: 'FOH' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Q4 tasks' })).toBeVisible()

  // The first group with something to do is open.
  await expect(group(page, 'Electrical')).toHaveAttribute('aria-expanded', 'true')
  await expect(group(page, 'Plumbing')).toHaveAttribute('aria-expanded', 'false')

  // Good saves at once, stays after a reload, and comes off again.
  const appliances = choices(page, 'Appliances (plugs, etc.)').getByRole('button', { name: 'Good' })
  await appliances.click()
  await expect(appliances).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('1/24', { exact: true })).toBeVisible()
  await page.reload()
  await expect(appliances).toHaveAttribute('aria-pressed', 'true')
  await appliances.click()
  await expect(appliances).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('0/24', { exact: true })).toBeVisible()

  // In-house opens a field under the item; the fix shows there and Good steps aside.
  await choices(page, 'Outlets').getByRole('button', { name: 'Add in-house fix for Outlets' }).click()
  const field = page.getByRole('textbox', { name: 'In-house fix for Outlets' })
  await expect(field).toBeFocused()
  await field.fill(FIX)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(FIX)).toBeVisible()
  await expect(field).toHaveCount(0)
  await expect(choices(page, 'Outlets').getByRole('button', { name: 'Good' })).toHaveCount(0)
  await expect(choices(page, 'Outlets').getByRole('button', { name: /Add another in-house fix/ })).toBeVisible()

  // The rest of Electrical marked Good: it closes with its check, and Plumbing opens.
  for (const name of ['Appliances (plugs, etc.)', 'Light bulbs', 'Emergency lights and signs', 'Feature']) {
    await choices(page, name).getByRole('button', { name: 'Good' }).first().click()
  }
  await expect(group(page, 'Electrical')).toHaveAttribute('aria-expanded', 'false')
  await expect(group(page, 'Electrical')).toContainText('5/5')
  await expect(group(page, 'Plumbing')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('5/24', { exact: true })).toBeVisible()

  await group(page, 'Electrical').click()
  await page.getByRole('button', { name: 'Help' }).click()
  await testInfo.attach('checklist', { body: await page.screenshot(), contentType: 'image/png' })

  // Ticket opens the quick ticket over the checklist (walkthrough-ticket.spec makes one).
  await choices(page, 'Outlets').getByRole('button', { name: 'Create ticket for Outlets' }).click()
  const sheet = page.getByRole('dialog', { name: 'Create ticket' })
  await expect(sheet.getByText('Outlets', { exact: true })).toBeVisible()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toHaveCount(0)
})

test('a walkthrough at another restaurant is not found', async ({ page }) => {
  await signIn(page, ARI)
  await page.goto(`/walkthrough/aaaaaaaa-aaaa-4aaa-8aaa-000000000003/${BOH}`)
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})
