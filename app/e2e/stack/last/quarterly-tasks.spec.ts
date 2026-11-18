import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from '../helpers'

/**
 * Ops · Quarterly tasks (WT-Ops-Tasks, OT-135) against the seed's two group tasks, which
 * fall in every quarter. In `last/`, after 6a's done test opens a month, since a change here
 * reaches the next walkthrough opened. Tasks the test adds are deleted at the end, and
 * Porter's removal and change are put back, so the next run starts the same.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

const editor = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name })

test('Ops adds, edits and deletes a task for every restaurant', async ({ page }, testInfo) => {
  const name = `Quarterly test · check gutters ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs/schedule')
  await page.getByRole('link', { name: /^Quarterly location tasks/ }).click()
  await expect(page).toHaveURL(/\/ops\/walkthroughs\/tasks$/)
  await expect(page.getByRole('heading', { name: 'Quarterly tasks' })).toBeVisible()
  await expect(page.getByText(/^Every restaurant gets these\./)).toBeVisible()
  await expect(page.getByText('Organize utility areas', { exact: true })).toBeVisible()
  await expect(page.getByText('Degrease BOH floors', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Porter/ })).toContainText('Uses the all-restaurants list')
  await shot(page, testInfo, 'quarterly · all restaurants')

  // A task the walkthroughs have had can only be turned off.
  await page.getByRole('button', { name: 'Edit Organize utility areas' }).click()
  let sheet = editor(page, 'Edit task')
  await expect(sheet.getByRole('button', { name: 'Turn off' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Delete for all restaurants' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // Add one, with a link that isn't a web address first.
  await page.getByRole('button', { name: /^Add Q\d task for all restaurants$/ }).click()
  sheet = editor(page, 'Add task')
  await sheet.getByLabel('Task name').fill(name)
  await sheet.getByLabel('Directions').fill('Look up at the gutters. Submit a ticket if one sags.')
  await sheet.getByLabel(/^How-to video link/).fill('not a link')
  await sheet.getByRole('button', { name: 'Add task' }).click()
  await expect(sheet.getByText('Use a web address that starts with https://')).toBeVisible()
  await sheet.getByLabel(/^How-to video link/).fill('https://example.com/gutters')
  await shot(page, testInfo, 'quarterly · add task')
  await sheet.getByRole('button', { name: 'Add task' }).click()
  await expect(sheet).toBeHidden()
  const row = page.getByText(name, { exact: true })
  await expect(row).toBeVisible()

  // Rename it, then delete it: no walkthrough has had it.
  await page.getByRole('button', { name: `Edit ${name}` }).click()
  sheet = editor(page, 'Edit task')
  await sheet.getByLabel('Task name').fill(`${name} and downspouts`)
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(`${name} and downspouts`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Edit ${name} and downspouts` }).click()
  await editor(page, 'Edit task').getByRole('button', { name: 'Delete for all restaurants' }).click()
  const confirm = editor(page, 'Delete this task?')
  await expect(confirm).toContainText('This is permanent and cannot be undone.')
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText(`${name} and downspouts`, { exact: true })).toHaveCount(0)
})

test('Ops removes, changes and adds tasks for one restaurant, and puts them back', async ({ page }, testInfo) => {
  const own = `Quarterly test · Porter's own ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs/tasks')
  await page.getByLabel('Tasks for').selectOption({ label: 'Porter' })
  await expect(page.getByText(/^Porter\. Changes here only apply to Porter\./)).toBeVisible()

  // Remove one for Porter, then restore it.
  await page.getByRole('button', { name: 'Remove Degrease BOH floors for Porter' }).click()
  await expect(page.getByText('Removed for Porter · 1')).toBeVisible()
  await page.getByText('Removed for Porter · 1').click()
  await page.getByRole('button', { name: 'Restore Degrease BOH floors' }).click()
  await expect(page.getByText(/^Removed for Porter/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit Degrease BOH floors' })).toBeVisible()

  // Change one for Porter, then go back to the group's version.
  await page.getByRole('button', { name: 'Edit Organize utility areas' }).click()
  let sheet = editor(page, 'Edit task')
  await expect(sheet).toContainText('Porter only')
  await sheet.getByLabel('Task name').fill('Organize utility areas and the cellar')
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByText('Changed for Porter')).toBeVisible()
  await shot(page, testInfo, 'quarterly · Porter')
  await page.getByRole('button', { name: 'Edit Organize utility areas and the cellar' }).click()
  await editor(page, 'Edit task').getByRole('button', { name: 'Use the all-restaurants version instead' }).click()
  await expect(page.getByText('Organize utility areas', { exact: true })).toBeVisible()
  await expect(page.getByText('Changed for Porter')).toHaveCount(0)

  // Its own task, then delete it.
  await page.getByRole('button', { name: /^Add Q\d task for Porter$/ }).click()
  sheet = editor(page, 'Add task')
  await sheet.getByLabel('Task name').fill(own)
  await sheet.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByText('Only Porter')).toBeVisible()
  await page.getByRole('button', { name: `Edit ${own}` }).click()
  await editor(page, 'Edit task').getByRole('button', { name: 'Delete task' }).click()
  await editor(page, 'Delete this task?').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText(own, { exact: true })).toHaveCount(0)

  // Back on the group's view, Porter uses the group's list again.
  await page.getByLabel('Tasks for').selectOption({ label: 'All restaurants' })
  await expect(page.getByRole('button', { name: /^Porter/ })).toContainText('Uses the all-restaurants list')
})
