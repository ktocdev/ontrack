import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Walkthrough · Review & submit against the seed: Ari's Ranalli's October walkthrough,
 * with checks still to do. Submitting can't be undone and every open walkthrough in the
 * seed is another flow's, so the submit call itself is answered here and checked for what
 * it sends; the database's side of submitting is pgTAP's (43_walkthroughs).
 */

const ARI = 'ari.kim@example.com'
const RANALLIS_OCT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'

test('review shows what is left and where, opens its lists, and asks before submitting early', async ({
  page,
}, testInfo) => {
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
  await expect(page.getByRole('link', { name: /in-house (fix|fixes), view and manage all/ })).toBeVisible()
  await testInfo.attach('review', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  // The Tickets count opens every ticket, and back again.
  await page.getByRole('link', { name: /tickets?, view and edit all/ }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/tickets$`))
  await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible()
  await expect(page.getByText(/^Tickets created · \d+$/)).toBeVisible()
  await page.getByRole('link', { name: 'Back to review' }).click()

  // The In-house count opens the fixes, whose Back returns here.
  await page.getByRole('link', { name: /in-house (fix|fixes), view and manage all/ }).click()
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
