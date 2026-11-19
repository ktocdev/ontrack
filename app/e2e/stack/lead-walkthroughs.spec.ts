import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Leadership · Walkthroughs (WT-Exec, OT-147) against the seed: October's four
 * walkthroughs, still open after Oct 31, so missed, and May to September's history. Other
 * flows check items and add tickets to October, so this reads the records, which they
 * leave alone: 12 of the 24 finished months on time, Ranalli's 5 of 6 with October missed,
 * Porter none of 6 with 3 missed. It only reads.
 */

test.use({ timezoneId: 'America/Chicago' })

test('leadership sees the month, the share on time, and each restaurant’s record', async ({ page }, testInfo) => {
  await signIn(page, 'lee.chen@example.com')
  await page.getByRole('navigation', { name: 'Leadership' }).getByRole('link', { name: 'Walkthroughs' }).click()
  await expect(page).toHaveURL(/\/lead\/walkthroughs$/)
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Walkthroughs', level: 1 })).toBeVisible()

  await expect(page.getByText('Submitted · October')).toBeVisible()
  await expect(page.getByText('0 of 4', { exact: true })).toBeVisible()
  await expect(page.getByText('On time · last 6 months')).toBeVisible()
  await expect(page.getByText('50%', { exact: true })).toBeVisible()
  await expect(page.getByText('October · due Oct 31')).toBeVisible()

  await expect(page.getByRole('img', { name: /: \d+ of \d+ checks done$/ })).toHaveCount(4)
  await expect(page.getByText('On time 5 of 6 months · 1 missed')).toBeVisible()
  await expect(page.getByText('On time 0 of 6 months · 3 missed')).toBeVisible()
  await expect(page.getByText('Missed', { exact: true })).toHaveCount(4)
  // Nothing on it leads anywhere or changes anything.
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0)

  await page.waitForTimeout(300)
  await testInfo.attach('walkthroughs', { body: await page.screenshot(), contentType: 'image/png' })
})
