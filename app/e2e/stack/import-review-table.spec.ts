import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

/**
 * The import review on a laptop (OT-161): every row of the file in a table beside the fix
 * cards, with fixes showing in the cells and each row's status as it will import. Nothing
 * is imported, so the seed is left as it was.
 */

test.use({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Chicago' })

test('the review shows every row in a table beside the fixes', async ({ page }, testInfo) => {
  const csv = [
    'Vendor,Type,Contact,Cell,Email',
    'Lakeview Glass Table,Refrig.,Ana Ruiz,(312) 555-0101,ana@lakeview.example.com',
    'No Phone Table,Plumbing,Pat Lee,,',
    'windy city glass & decor,,,,',
  ].join('\n')

  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/ops/contractors/import')
  await page
    .getByLabel('Spreadsheet to import')
    .setInputFiles({ name: 'Vendors.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Next: match columns' }).click()
  await page.getByRole('button', { name: 'Next: review rows' }).click()
  await expect(page.getByRole('heading', { name: 'Review 3 rows' })).toBeVisible()

  const table = page.getByRole('region', { name: 'Every row' })
  await expect(table.getByRole('columnheader')).toHaveText([
    'Row',
    'Company',
    'Trade',
    'Contact name',
    'Phone',
    'Email',
    'Status',
  ])
  const row = (n: number) =>
    table.getByRole('row').filter({ has: page.getByRole('cell', { name: String(n), exact: true }) })
  await expect(row(2)).toContainText('Refrig.')
  await expect(row(2)).toContainText('Needs a fix')
  await expect(row(3)).toContainText('Missing')
  await expect(row(4)).toContainText('In OnTrack · skipped')
  await testInfo.attach('review table', { body: await page.screenshot(), contentType: 'image/png' })

  // A fix made on its card shows in the cell, and the row is ready.
  await page.getByRole('region', { name: '“Refrig.” isn’t a trade' }).getByRole('button', { name: 'Save' }).click()
  await expect(row(2)).toContainText('Refrigeration')
  await expect(row(2)).toContainText('Ready')

  // Skipping the row with no phone, and updating Windy City, change their status.
  await page.getByRole('region', { name: 'Phone is missing' }).getByRole('button', { name: 'Skip this row' }).click()
  await expect(row(3)).toContainText('Skipped')
  await page
    .getByRole('region', { name: 'Windy City Glass & Decor' })
    .getByRole('radio', { name: 'Update existing' })
    .click()
  await expect(row(4)).toContainText('Updates existing')
  await expect(page.getByRole('button', { name: 'Import 2 contractors' })).toBeEnabled()
  await testInfo.attach('review table fixed', { body: await page.screenshot(), contentType: 'image/png' })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the review stays the cards, with no table', async ({ page }) => {
    await signIn(page, 'bert.velilla@example.com')
    await page.goto('/ops/contractors/import')
    await page.getByLabel('Spreadsheet to import').setInputFiles({
      name: 'Vendors.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Vendor,Type,Contact,Cell\nA,Plumbing,B,1'),
    })
    await page.getByRole('button', { name: 'Next: match columns' }).click()
    await page.getByRole('button', { name: 'Next: review rows' }).click()
    await expect(page.getByRole('heading', { name: 'Review 1 row' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Every row' })).toHaveCount(0)
  })
})
