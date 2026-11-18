import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from '../helpers'

/**
 * Ops · Checklist editor (OT-136) against the seed's Kitchen + Exterior, month A of the
 * group's rotation, which past walkthroughs have had. In `last/`, named to run after 6a's
 * done test and the schedule's flow, since the first change makes a new version that the
 * rotation's month moves to. What the test adds it deletes, so the version reads as before.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'
const KITCHEN_EXT = '88888888-8888-4888-8888-000000000002'

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

test('Ops edits a checklist a walkthrough has had: the change makes a new version', async ({ page }, testInfo) => {
  const item = `Editor test · panel labels ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs/schedule')
  await page.getByRole('button', { name: 'Edit month A' }).click()
  await page.getByRole('dialog', { name: 'Month A' }).getByRole('button', { name: 'Edit this checklist' }).click()
  await expect(page).toHaveURL(/\/ops\/walkthroughs\/checklists\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Kitchen + Exterior' })).toBeVisible()

  // An item the walkthroughs have had can only be turned off.
  const firstItem = page.getByRole('button', { name: /directions|No category/ }).first()
  await firstItem.click()
  let sheet = page.getByRole('dialog', { name: 'Item' })
  await expect(sheet.getByRole('button', { name: 'Turn off' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Delete item' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await shot(page, testInfo, 'checklist editor')

  // Add an item to Kitchen; a link that isn't a web address is refused first.
  const before = page.url()
  await page.getByRole('button', { name: 'Add item to Kitchen' }).click()
  sheet = page.getByRole('dialog', { name: 'Add item' })
  await sheet.getByLabel('Group').fill('Electrical')
  await sheet.getByLabel('Item').fill(item)
  await sheet.getByLabel(/^How-to video link/).fill('not a link')
  await sheet.getByRole('button', { name: 'Add item' }).click()
  await expect(sheet.getByText('Use a web address that starts with https://')).toBeVisible()
  await sheet.getByLabel(/^How-to video link/).fill('https://example.com/panel')
  await shot(page, testInfo, 'checklist editor · add item')
  await sheet.getByRole('button', { name: 'Add item' }).click()
  await expect(sheet).toBeHidden()

  // The walkthroughs that had it keep theirs; the edit is a new version.
  if (before.endsWith(KITCHEN_EXT)) await expect(page).not.toHaveURL(new RegExp(`${KITCHEN_EXT}$`))
  await expect(page.getByText(/^No walkthrough has had this version yet\./)).toBeVisible()
  await expect(page.getByText(item)).toBeVisible()

  // An item added since has no history: it can be deleted.
  await page.getByRole('button', { name: new RegExp(item) }).click()
  sheet = page.getByRole('dialog', { name: 'Item' })
  await sheet.getByRole('button', { name: 'Delete item' }).click()
  await expect(sheet).toContainText('This is permanent and cannot be undone.')
  await sheet.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText(item)).toHaveCount(0)

  // Order the items, unchanged, and save.
  await page.getByRole('button', { name: 'Order items' }).first().click()
  sheet = page.getByRole('dialog', { name: 'Order items' })
  await sheet.getByRole('button', { name: 'Save order' }).click()
  await expect(sheet).toBeHidden()

  // The schedule's month A is still Kitchen + Exterior, the new version.
  await page.getByRole('link', { name: 'Back to the schedule' }).click()
  await expect(page).toHaveURL(/\/ops\/walkthroughs\/schedule/)
  await expect(page.getByRole('button', { name: 'Edit month A' })).toBeVisible()
  await expect(page.getByText('Kitchen + Exterior', { exact: true }).first()).toBeVisible()
})

test('Ops makes a new checklist from a month’s, and deletes it while nothing uses it', async ({ page }) => {
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs/schedule')
  await page.getByRole('button', { name: 'Edit month B' }).click()
  await page
    .getByRole('dialog', { name: 'Month B' })
    .getByRole('button', { name: 'Make a new checklist from this one' })
    .click()
  await expect(page.getByRole('heading', { name: 'Back of House + Front of House (new)' })).toBeVisible()
  await expect(
    page.getByText(/^No walkthrough has had this version yet\. Changes go on any month that picks it/),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Checklist' })
  await sheet.getByRole('button', { name: 'Delete checklist' }).click()
  await sheet.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page).toHaveURL(/\/ops\/walkthroughs\/schedule/)
})
