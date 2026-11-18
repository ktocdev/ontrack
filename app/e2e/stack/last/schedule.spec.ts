import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from '../helpers'

/**
 * Ops · Walkthrough schedule (WT-Ops-Schedule, OT-133) against the seed: the group's A
 * Kitchen + Exterior and B Back of House + Front of House from January 2026, and Ranalli's
 * on a three-month rotation of its own. In `last/`, after 6a's done test opens November from
 * the group's rotation, since this changes it; every change is put back, so the next run and
 * the other browser start from the seed.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'
const RANALLIS = '11111111-1111-4111-8111-000000000004'

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

const setting = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) })

test('Ops reads the group’s schedule and every restaurant’s rotation', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs')
  await page.getByRole('link', { name: 'Schedule' }).click()
  await expect(page).toHaveURL(/\/ops\/walkthroughs\/schedule$/)
  await expect(page.getByRole('heading', { name: 'Walkthrough schedule' })).toBeVisible()

  await expect(page.getByText(/^Group schedule\. Every restaurant uses this unless it has its own\./)).toBeVisible()
  await expect(page.getByText('Rotation · 2-month cycle')).toBeVisible()
  await expect(page.getByText('Kitchen + Exterior', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Back of House + Front of House', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('listitem', { name: /^Jan: Kitchen \+ Exterior/ })).toBeVisible()
  await expect(page.getByRole('listitem', { name: /^Feb: Back of House \+ Front of House/ })).toBeVisible()
  await expect(page.getByRole('listitem', { name: /, this month$/ })).toHaveCount(1)
  await expect(setting(page, 'Due date')).toContainText('Last day of the month')
  await expect(setting(page, 'Reminders')).toContainText('7 and 2 days before')
  await expect(page.getByRole('button', { name: /^Ranalli’s Logan Square/ })).toContainText('Ranalli’s · 3-month')
  await expect(page.getByRole('button', { name: /^Porter/ })).toContainText('Group')
  await shot(page, testInfo, 'schedule · group')

  // A restaurant with its own rotation, from the list.
  await page.getByRole('button', { name: /^Ranalli’s Logan Square/ }).click()
  await expect(page).toHaveURL(new RegExp(`\\?restaurant=${RANALLIS}$`))
  await expect(page.getByText(/Ranalli’s Logan Square has its own schedule/)).toBeVisible()
  await expect(page.getByText('Rotation · 3-month cycle')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Switch back to group schedule' })).toBeVisible()
  await shot(page, testInfo, 'schedule · own')
})

test('Ops changes the group’s cycle, due date and reminders, and puts them back', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs/schedule')

  // Add a third month, then remove it.
  await page.getByRole('button', { name: 'Add a month to the cycle' }).click()
  let sheet = page.getByRole('dialog', { name: 'Add month C' })
  const checklist = sheet.getByLabel('Checklist')
  const storage = await checklist.locator('option', { hasText: /^Exterior \+ Storage/ }).getAttribute('value')
  await checklist.selectOption(storage!)
  await sheet.getByRole('button', { name: 'Add month' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByText('Rotation · 3-month cycle')).toBeVisible()
  await expect(page.getByRole('listitem', { name: /^Mar: Exterior \+ Storage/ })).toBeVisible()
  await page.getByRole('button', { name: 'Edit month C' }).click()
  sheet = page.getByRole('dialog', { name: 'Month C' })
  await sheet.getByRole('button', { name: 'Remove month C from the cycle' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByText('Rotation · 2-month cycle')).toBeVisible()

  // The due date, then back to the last day.
  await setting(page, 'Due date').click()
  sheet = page.getByRole('dialog', { name: 'Due date' })
  await sheet.getByLabel('Due').selectOption('25')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(setting(page, 'Due date')).toContainText('The 25th')
  await setting(page, 'Due date').click()
  await sheet.getByLabel('Due').selectOption('')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(setting(page, 'Due date')).toContainText('Last day of the month')

  // A third reminder, then back to two.
  await setting(page, 'Reminders').click()
  sheet = page.getByRole('dialog', { name: 'Reminders' })
  await sheet.getByRole('button', { name: '1 day', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(setting(page, 'Reminders')).toContainText('7, 2 and 1 days before')
  await setting(page, 'Reminders').click()
  await sheet.getByRole('button', { name: '1 day', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(setting(page, 'Reminders')).toContainText('7 and 2 days before')
})

test('Ops puts Porter on Ranalli’s rotation, shared, and switches it back', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs/schedule')
  await page.getByLabel('Schedule for').selectOption({ label: 'Porter' })
  await expect(page.getByText(/^Porter follows the group schedule\./)).toBeVisible()
  // Following the group's, its months aren't edited from here.
  await expect(page.getByRole('button', { name: /^Edit month/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Give Porter its own schedule' }).click()
  const sheet = page.getByRole('dialog', { name: 'Give Porter its own schedule' })
  await sheet.getByRole('radio', { name: /^Ranalli’s/ }).click()
  await sheet.getByRole('button', { name: 'Use this rotation' }).click()
  await expect(sheet).toBeHidden()
  await expect(
    page.getByText(/^Porter has its own schedule, Ranalli’s, shared with Ranalli’s Logan Square/),
  ).toBeVisible()
  await expect(page.getByText('Rotation · 3-month cycle')).toBeVisible()

  await page.getByRole('button', { name: 'Switch back to group schedule' }).click()
  await expect(page.getByText(/^Porter follows the group schedule\./)).toBeVisible()
  await expect(page.getByText('Rotation · 2-month cycle')).toBeVisible()
})
