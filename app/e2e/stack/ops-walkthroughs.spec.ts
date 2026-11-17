import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Ops · Walkthroughs (WT-Ops-Overview, OT-129) against the seed: October's four
 * walkthroughs, still open after Oct 31, so missed, and May to September's history. Other
 * flows check items and add tickets to October, so this one reads standings and the
 * history, not counts. It only reads, so both browsers run it as they like; the picker's
 * choice is remembered per person, so it goes back to All restaurants at the end.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

test('Ops sees each restaurant’s month and the last six, a month at a time, by restaurant', async ({
  page,
}, testInfo) => {
  await signIn(page, BERT)
  await page.getByRole('link', { name: 'Walkthroughs' }).click()
  await expect(page).toHaveURL(/\/ops\/walkthroughs$/)
  await expect(page.getByRole('heading', { name: 'Walkthroughs' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Schedule' })).toBeVisible()

  // The newest month first, with nothing after it.
  await expect(page.getByText('October 2026')).toBeVisible()
  await expect(page.getByText('Full walkthrough · BOH + FOH · due Oct 31')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled()
  await expect(page.getByText(/^0 of 4 submitted$/)).toBeVisible()
  const rows = page.getByRole('link', { name: /, \d+ of \d+$/ })
  await expect(rows).toHaveCount(4)
  await expect(rows.first()).toContainText('Missed')
  await shot(page, testInfo, 'overview · October')

  // September: all four in, one of them late.
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page).toHaveURL(/\?month=2026-09$/)
  await expect(page.getByText('September 2026')).toBeVisible()
  await expect(page.getByText(/^4 of 4 submitted$/)).toBeVisible()
  await expect(page.getByRole('link', { name: /^Porter, / })).toContainText('Submitted Oct 3')
  await expect(page.getByRole('button', { name: 'Next month' })).toBeEnabled()

  // The last six months, folded to begin with.
  await page.getByText('Last 6 months').click()
  await expect(page.getByRole('img', { name: 'Porter, July: Late' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Federale’s Logan Square, June: Missed' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Ranalli’s Logan Square, May: On time' })).toBeVisible()
  await expect(page.getByText('Federale’s West Loop, April: No walkthrough')).toBeAttached()
  await page.getByText('Last 6 months').scrollIntoViewIfNeeded()
  await shot(page, testInfo, 'overview · September with history')

  // The picker narrows it to one restaurant, and the address keeps the month.
  try {
    await page.getByRole('button', { name: /All restaurants \(\d+\)/ }).click()
    await page.getByRole('menuitemradio', { name: 'Porter' }).click()
    await expect(page.getByText(/^1 of 1 submitted$/)).toBeVisible()
    await expect(page.getByRole('img', { name: /^Federale’s/ })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Porter, August: Missed' })).toBeVisible()
  } finally {
    await page.getByRole('button', { name: 'Porter', exact: true }).click()
    await page.getByRole('menuitemradio', { name: /^All restaurants/ }).click()
  }

  // A row opens that restaurant's walkthrough (OT-130 builds it), and Back returns to the month.
  await page.getByRole('link', { name: /^Porter, / }).click()
  await expect(page).toHaveURL(/\/ops\/walkthroughs\/[0-9a-f-]{36}$/)
  await page.goBack()
  await expect(page.getByText('September 2026')).toBeVisible()
})

test('a Reporter has no walkthroughs overview', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/ops/walkthroughs')
  await expect(page.getByRole('heading', { name: 'Walkthroughs' })).toHaveCount(0)
})
