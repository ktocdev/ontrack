import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Manager · Walkthrough home against the seed. October's walkthroughs are open and due
 * Oct 31; Logan Square also has September's, submitted. Dana's Porter walkthrough gets
 * three items marked Good and one in-house fix first, through the functions the checklist
 * will use, and no tickets, so no other flow's counts move. Each step is safe to repeat.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const DANA = 'dana.ortiz@example.com'
const PORTER_OCT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'
const item = (n: number) => `dddddddd-dddd-4ddd-8ddd-${String(100 + n).padStart(12, '0')}`

async function rpc(request: APIRequestContext, email: string, name: string, data: object) {
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/${name}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, email)}` },
    data,
  })
  expect(res.ok(), await res.text()).toBe(true)
  return res
}

async function porterFixes(request: APIRequestContext) {
  const res = await request.get(
    `${SUPABASE}/rest/v1/v_walkthrough_progress?select=fixes&walkthrough_id=eq.${PORTER_OCT}&short_name=eq.BOH`,
    { headers: { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, DANA)}` } },
  )
  return ((await res.json()) as { fixes: number }[])[0]?.fixes ?? 0
}

test('a manager sees this month by section, its flags and the way to review', async ({ page, request }, testInfo) => {
  for (const n of [1, 2, 3]) {
    await rpc(request, DANA, 'set_walkthrough_good', { p_walkthrough_id: PORTER_OCT, p_item_id: item(n) })
  }
  if ((await porterFixes(request)) === 0) {
    await rpc(request, DANA, 'add_walkthrough_fix', {
      p_walkthrough_id: PORTER_OCT,
      p_title: 'Tighten the outlet cover by the dish pit',
      p_item_id: item(4),
    })
  }

  await signIn(page, DANA)
  await page.getByRole('link', { name: 'Walkthrough' }).click()
  await expect(page).toHaveURL(/\/walkthrough$/)
  await expect(page.getByRole('heading', { name: 'Walkthrough', level: 1 })).toBeVisible()

  const card = page.getByRole('region', { name: 'October walkthrough' })
  await expect(card.getByText('Due Sat, Oct 31')).toBeVisible()
  await expect(card.getByRole('heading', { name: 'Back of House + Front of House' })).toBeVisible()
  await expect(card.getByRole('img', { name: '4 of 50 checks done' })).toBeVisible()
  await expect(card.getByText('Saved automatically')).toBeVisible()

  const boh = card.getByRole('link', { name: /^Back of House/ })
  await expect(boh).toContainText('4 of 24')
  await expect(boh).toContainText('1 in-house')
  await expect(card.getByRole('link', { name: /^Front of House/ })).toContainText('0 of 24')
  await expect(card.getByRole('link', { name: /^Q4 location tasks/ })).toContainText('0 of 2')

  // Not done yet, so Review & submit is the outline button, and nothing is past at Porter.
  await expect(card.getByRole('link', { name: 'Review & submit' })).toHaveClass(/border-brand/)
  await expect(page.getByRole('button', { name: 'Past walkthroughs' })).toHaveCount(0)
  await testInfo.attach('walkthrough home', { body: await page.screenshot(), contentType: 'image/png' })

  // A section opens its checklist (OT-105 builds it).
  await boh.click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${PORTER_OCT}/cccccccc-cccc-4ccc-8ccc-000000000001$`))
})

test('past walkthroughs open under the card and say how each month went', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/walkthrough')
  await expect(page.getByRole('region', { name: 'October walkthrough' })).toBeVisible()

  const past = page.getByRole('button', { name: 'Past walkthroughs' })
  await expect(past).toHaveAttribute('aria-expanded', 'false')
  await past.click()
  const list = page.getByRole('region', { name: 'Past walkthroughs' })
  await expect(list.getByText('Sep')).toBeVisible()
  await expect(list.getByText('BOH + FOH')).toBeVisible()
  await expect(list.getByText('All good')).toBeVisible()
})
