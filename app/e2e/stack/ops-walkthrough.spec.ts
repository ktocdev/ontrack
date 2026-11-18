import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Ops · one restaurant's walkthrough (WT-Ops-Restaurant, OT-130) against the seed: October,
 * open past its due day, with Logan Square's two linked tickets and its in-house fixes, and
 * May to September before it. Other flows add to October, so this reads what is there, not
 * counts. Send reminder goes out once an hour, and send-push.spec.ts reminds Porter and
 * Ranalli's, so each browser takes its own: Logan Square, which Maya started, on Chromium;
 * West Loop, which nobody has, on WebKit. A second run within the hour needs `db reset`.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'
const OCTOBER = {
  chromium: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
    name: 'Federale’s Logan Square',
    send: 'Send Maya a reminder',
    sent: 'Reminder sent to Maya',
  },
  webkit: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
    name: 'Federale’s West Loop',
    send: 'Send a reminder',
    sent: 'Reminder sent',
  },
}

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

test('Ops opens a restaurant’s month, sees what it flagged, and sends a reminder', async ({ page }, testInfo) => {
  const mine = OCTOBER[testInfo.project.use.defaultBrowserType === 'webkit' ? 'webkit' : 'chromium']
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs')
  await page.getByRole('link', { name: new RegExp(`^${mine.name}, `) }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/walkthroughs/${mine.id}$`))

  await expect(page.getByRole('heading', { name: mine.name })).toBeVisible()
  await expect(page.getByText('Walkthroughs · October')).toBeVisible()
  await expect(page.getByText('Missed', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /^Back of House: \d+ of 24$/ })).toBeVisible()
  await expect(page.getByRole('img', { name: /^Front of House: \d+ of 24$/ })).toBeVisible()
  await expect(page.getByRole('img', { name: /^Q4 tasks: \d+ of 2$/ })).toBeVisible()
  await expect(page.getByText('Flagged so far')).toBeVisible()

  // Send reminder, once.
  await expect(page.getByText(/^Last reminder:/)).toBeVisible()
  await page.getByRole('button', { name: mine.send }).click()
  await expect(page.getByRole('button', { name: mine.sent })).toBeDisabled()
  await expect(page.getByText(/^Last reminder: today at \d{1,2}:\d{2} [AP]M$/)).toBeVisible()
  await shot(page, testInfo, 'one restaurant · reminder sent')

  // The months before it; one opens as its own page, submitted, with no reminder.
  await page.getByText('Past walkthroughs').click()
  const sep = page.getByRole('link', { name: /^Sep/ })
  await expect(sep).toContainText(/Sep \d+ · /)
  await sep.click()
  await expect(page.getByText('Walkthroughs · September')).toBeVisible()
  await expect(page.getByText(/^Submitted Sep \d+$/)).toBeVisible()
  await expect(page.getByRole('button', { name: /reminder/ })).toHaveCount(0)

  // Back returns to the overview at that month.
  await page.getByRole('link', { name: 'Back to all walkthroughs' }).click()
  await expect(page).toHaveURL(/\/ops\/walkthroughs\?month=2026-09$/)
  await expect(page.getByText('September 2026')).toBeVisible()
})

test('a ticket the walkthrough flagged opens on the Ops ticket page', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto(`/ops/walkthroughs/${OCTOBER.chromium.id}`)
  await page.getByRole('link', { name: /OT-1042/ }).click()
  await expect(page).toHaveURL(/\/ops\/tickets\/66666666-6666-4666-8666-000000001042$/)
})

test('a walkthrough that doesn’t exist is not found', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs/not-a-walkthrough')
  await expect(page.getByRole('heading', { name: /can.t find that page/ })).toBeVisible()
})

test('a Reporter has no such page', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/ops/walkthroughs/${OCTOBER.chromium.id}`)
  await expect(page.getByText('Flagged so far')).toHaveCount(0)
})
