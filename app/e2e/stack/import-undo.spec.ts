import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Undo an import for 24 hours (OT-153) against the seed: Bert imports a contractor and a
 * unit, each list then offers Undo for his latest import, the confirm step says what it takes
 * back, and Undo takes it. What undo keeps when something points to a row is in pgTAP
 * (65_imports, 66_import_undo_preview). Names carry the run, so both browsers run it.
 */

test.use({ timezoneId: 'America/Chicago' })

const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

async function importSheet(page: Page, path: string, file: string, csv: string, button: RegExp) {
  await page.goto(path)
  await page
    .getByLabel('Spreadsheet to import')
    .setInputFiles({ name: file, mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Next: match columns' }).click()
  await page.getByRole('button', { name: 'Next: review rows' }).click()
  await page.getByRole('button', { name: button }).click()
  await expect(page.getByRole('heading', { name: /imported$/ })).toBeVisible()
}

test('Bert undoes a contractor import from Contractors', async ({ page }, testInfo) => {
  const name = `Undo Me ${run(testInfo.project.name)}`
  await signIn(page, 'bert.velilla@example.com')
  await importSheet(
    page,
    '/ops/contractors/import',
    'undo.csv',
    ['Company,Trade,Contact name,Phone', `${name},Plumbing,Al Frost,(312) 555-0109`].join('\n'),
    /^Import 1 contractor$/,
  )
  await page.getByRole('link', { name: 'View contractors' }).click()
  await expect(page.getByRole('article', { name })).toBeVisible()

  await expect(page.getByText(/^You imported 1 contractor from undo\.csv · /)).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Undo this import?' })
  await expect(sheet).toContainText('Removes 1 contractor it added.')
  await expect(sheet).toContainText(/You can undo it until /)
  await shot(page, testInfo, 'confirm')
  await sheet.getByRole('button', { name: 'Undo import' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Import undone. Removed 1 contractor.' })).toBeVisible()
  await expect(page.getByRole('article', { name })).toHaveCount(0)
  await expect(page.getByText(/^You imported .* from undo\.csv/)).toHaveCount(0)
})

test('Bert undoes an equipment import from Equipment, or keeps it', async ({ page }, testInfo) => {
  const name = `Undo unit ${run(testInfo.project.name)}`
  await signIn(page, 'bert.velilla@example.com')
  await importSheet(
    page,
    '/ops/equipment/import',
    'undo-units.csv',
    ['Name,Restaurant,Area,Category', `${name},Porter,BOH,Cooking`].join('\n'),
    /^Import 1 unit$/,
  )
  await page.getByRole('link', { name: 'View equipment' }).click()
  await expect(page.getByText(/^You imported 1 unit from undo-units\.csv · /)).toBeVisible()

  // Keep it closes the sheet and changes nothing.
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('dialog', { name: 'Undo this import?' }).getByRole('button', { name: 'Keep it' }).click()
  await page.getByRole('searchbox', { name: 'Search equipment' }).fill(name)
  await expect(page.getByText(name)).toBeVisible()

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('dialog', { name: 'Undo this import?' }).getByRole('button', { name: 'Undo import' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Import undone. Removed 1 unit.' })).toBeVisible()
  await expect(page.getByText(name, { exact: true })).toHaveCount(0)
  await expect(page.getByText(`No equipment matches “${name}”.`)).toBeVisible()
})
