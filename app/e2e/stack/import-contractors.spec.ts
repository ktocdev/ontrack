import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Import contractors (Import-Contractors-*, OT-151) against the seed: Bert chooses a CSV
 * laid out his own way, matches its columns (one by a suggestion), fixes a trade the list
 * doesn't have and adds another as a new trade, skips a row with no phone, updates one
 * already in OnTrack, and imports. Names carry the run, so both browsers run it on one stack.
 */

test.use({ timezoneId: 'America/Chicago' })

const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

test('Bert imports a contractor sheet: matched, fixed, skipped, updated, done', async ({ page }, testInfo) => {
  const r = run(testInfo.project.name)
  const glass = `Glass ${r}`
  const lakeview = `Lakeview Glass ${r}`
  const arctic = `Arctic Air ${r}`
  const csv = [
    'Vendor,Type,Contact,Cell,Email,Ins. exp,Notes,Acct #',
    `${lakeview},${glass},Ana Ruiz,(312) 555-0101,ana@lakeview.example.com,3/31/2027,,A-1`,
    `${arctic},Refrig.,Al Frost,(312) 555-0102,,,,A-2`,
    `No Phone ${r},Plumbing,Pat Lee,,,,,A-3`,
    `windy city glass & decor,,,,,,Imported note ${r},A-4`,
  ].join('\n')

  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/ops/contractors')
  await page.getByRole('button', { name: 'More options for contractors' }).click()
  await page.getByRole('menuitem', { name: 'Import from a spreadsheet' }).click()
  await expect(page).toHaveURL(/\/ops\/contractors\/import$/)
  await expect(page.getByRole('heading', { name: 'Import contractors' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next: match columns' })).toBeDisabled()
  await shot(page, testInfo, 'start')

  await page
    .getByLabel('Spreadsheet to import')
    .setInputFiles({ name: 'Vendors 2026.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByText('4 rows · 8 columns · first sheet')).toBeVisible()
  await page.getByRole('button', { name: 'Next: match columns' }).click()

  // Match columns: Vendor, Type, Contact and Cell by their names; Ins. exp only suggested.
  await expect(page.getByRole('heading', { name: 'Match columns' })).toBeVisible()
  await expect(page.getByLabel('Company: which column?')).toHaveValue('0')
  await expect(page.getByLabel('Phone: which column?')).toHaveValue('3')
  await expect(page.getByLabel('Insurance expires: which column?')).toHaveValue('')
  await shot(page, testInfo, 'match columns')
  await page.getByRole('button', { name: 'Use “Ins. exp”?' }).click()
  await expect(page.getByLabel('Insurance expires: which column?')).toHaveValue('5')
  await expect(page.getByText('Acct #', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next: review rows' }).click()

  // Review: two trades to fix, a phone missing, and Windy City already in OnTrack.
  await expect(page.getByRole('heading', { name: 'Review 4 rows' })).toBeVisible()
  const refrig = page.getByRole('region', { name: '“Refrig.” isn’t a trade' })
  await expect(refrig.getByRole('combobox')).toHaveValue('Refrigeration')
  await shot(page, testInfo, 'review')
  await refrig.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Set to Refrigeration · 1 row ready')).toBeVisible()

  const newTrade = page.getByRole('region', { name: `“${glass}” isn’t a trade` })
  await newTrade.getByRole('combobox').selectOption({ label: `Add “${glass}” as a new trade` })
  await newTrade.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('region', { name: 'Phone is missing' }).getByRole('button', { name: 'Skip this row' }).click()
  await expect(page.getByText('Skipped 1 row')).toBeVisible()

  const dup = page.getByRole('region', { name: 'Windy City Glass & Decor' })
  await dup.getByRole('radio', { name: 'Update existing' }).click()

  await page.getByRole('button', { name: 'Import 3 contractors' }).click()
  await expect(page.getByRole('heading', { name: '3 contractors imported' })).toBeVisible()
  await expect(page.getByText('From Vendors 2026.csv')).toBeVisible()
  await expect(page.getByText(/^Added\s*2$/)).toBeVisible()
  await expect(page.getByText(/^Updated\s*1$/)).toBeVisible()
  await expect(page.getByText(/^Skipped\s*1$/)).toBeVisible()
  await shot(page, testInfo, 'done')

  await page.getByRole('link', { name: 'View contractors' }).click()
  await expect(page).toHaveURL(/\/ops\/contractors$/)
  await page.getByRole('searchbox', { name: 'Search contractors' }).fill(r)
  await expect(page.getByRole('article', { name: lakeview })).toContainText(glass)
  await expect(page.getByRole('article', { name: arctic })).toContainText('Refrigeration')
  await expect(page.getByRole('article', { name: `No Phone ${r}` })).toHaveCount(0)
})

test('Add contractor leads to the import, and Cancel goes back to the directory', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/ops/contractors/new')
  await page.getByRole('link', { name: /Adding a lot of contractors\?/ }).click()
  await expect(page).toHaveURL(/\/ops\/contractors\/import$/)
  await page.getByRole('link', { name: 'Cancel import' }).click()
  await expect(page).toHaveURL(/\/ops\/contractors$/)
})

test('a Reporter has no import', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/ops/contractors/import')
  await expect(page.getByRole('heading', { name: 'Import contractors' })).toHaveCount(0)
})
