import { expect, test, type Page } from '@playwright/test'
import { openRestaurants, signIn, tokenFor } from './helpers'

/**
 * Show first (OT-174): which area's tickets come first inside each restaurant, after the
 * urgent ones, picked on Sort restaurants and saved on the account. It starts from the job
 * title: Bert has none, so Front of House; Theo is IT, so IT. Bert puts it back at the end,
 * which deletes his row, so the seed is as it was.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

// However a run ends, Bert follows his title again.
test.afterEach(async ({ request }) => {
  const token = await tokenFor(request, 'bert.velilla@example.com')
  await request.delete(`${SUPABASE}/rest/v1/first_area_prefs?user_id=not.is.null`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
})

const WEST_LOOP = 'Federale’s West Loop'
const POS = /OT-1034/ // the seed's IT ticket at West Loop, the newest there

async function openSheet(page: Page) {
  await page.getByRole('button', { name: 'More ticket options' }).click()
  await page.getByRole('menuitem', { name: 'Sort restaurants' }).click()
  return page.getByRole('dialog', { name: 'Sort restaurants' })
}

/** The first card at West Loop that isn't urgent. */
const firstNotUrgent = (page: Page) =>
  page
    .getByRole('region', { name: WEST_LOOP, exact: true })
    .getByRole('link', { name: /OT-\d+/ })
    .filter({ hasNotText: 'URGENT' })
    .first()

test('Show first puts the area picked after the urgent tickets, and follows the account', async ({
  page,
}, testInfo) => {
  await signIn(page, 'bert.velilla@example.com')
  await openRestaurants(page)
  await expect(firstNotUrgent(page)).not.toHaveAccessibleName(POS)

  const sheet = await openSheet(page)
  const showFirst = sheet.getByRole('radiogroup', { name: 'Show first' })
  await expect(showFirst.getByRole('radio', { name: 'Front' })).toHaveAttribute('aria-checked', 'true')
  await showFirst.getByRole('radio', { name: 'IT' }).click()
  await expect(showFirst.getByRole('radio', { name: 'IT' })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet.getByText('Saved to your account, on every device.', { exact: false })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('show first', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(firstNotUrgent(page)).toHaveAccessibleName(POS)

  // As on another device: nothing kept on this one but the session and the install prompt's answer,
  // and still IT first, read from the account.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (!['ontrack.install-asked', 'ontrack.auth'].includes(key)) localStorage.removeItem(key)
  })
  await page.reload()
  await openRestaurants(page)
  await expect(firstNotUrgent(page)).toHaveAccessibleName(POS)

  // Back to his title's, which keeps no row of his own.
  const again = await openSheet(page)
  await again.getByRole('radiogroup', { name: 'Show first' }).getByRole('radio', { name: 'Front' }).click()
  await again.getByRole('button', { name: 'Done' }).click()
  await expect(firstNotUrgent(page)).not.toHaveAccessibleName(POS)
  await page.reload()
  await openRestaurants(page)
  await expect(firstNotUrgent(page)).not.toHaveAccessibleName(POS)
})

test('the IT title starts on IT', async ({ page }) => {
  await signIn(page, 'theo.grant@example.com')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  const sheet = await openSheet(page)
  await expect(
    sheet.getByRole('radiogroup', { name: 'Show first' }).getByRole('radio', { name: 'IT' }),
  ).toHaveAttribute('aria-checked', 'true')
})
