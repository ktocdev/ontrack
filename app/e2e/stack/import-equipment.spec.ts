import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Import equipment (Import-Equipment-*, OT-152) against the seed: Bert chooses a sheet for
 * all restaurants with a Location column, fixes "Federales LS" once for its rows, a
 * category the area doesn't have and an area that's missing, skips a row whose category
 * can't be matched, keeps Logan Square's walk-in (found by its name; a serial match is in
 * equipmentImport.test.ts) as it is by updating it with the brand it already has, and imports. Names carry the run, so both browsers run
 * it on one stack.
 */

test.use({ timezoneId: 'America/Chicago' })

const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

test('Bert imports an equipment sheet for every restaurant: matched, fixed, skipped, updated', async ({
  page,
}, testInfo) => {
  const r = run(testInfo.project.name)
  const csv = [
    'Item,Location,FOH/BOH,Category,Make,Serial,Install date,Notes',
    `Bar fridge ${r},Federales LS,BOH,Refrigeration,True,,3/2022,Under the bar`,
    `Patio heater ${r},Federales West Loop,FOH,Lights,Infratech,,,`,
    `Walk-in Cooler 1,Federales LS,BOH,Refrigeration,Kolpak,KP-7XW-220418,,`,
    `Glass washer ${r},Porter,,Refrigeration,Hoshizaki,,,`,
    `Mystery box ${r},Porter,BOH,Juggling,,,,`,
  ].join('\n')

  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/ops/equipment')
  await page.getByRole('button', { name: 'More options for equipment' }).click()
  await page.getByRole('menuitem', { name: 'Import from a spreadsheet' }).click()
  await expect(page).toHaveURL(/\/ops\/equipment\/import/)
  await expect(page.getByRole('heading', { name: 'Import equipment' })).toBeVisible()

  await page
    .getByLabel('Spreadsheet to import')
    .setInputFiles({ name: 'Equipment - all locations.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByText('5 rows · 8 columns · first sheet')).toBeVisible()
  await page.getByRole('button', { name: 'Next: match columns' }).click()

  await expect(page.getByRole('heading', { name: 'Match columns' })).toBeVisible()
  await expect(page.getByLabel('Restaurant: which column?')).toHaveValue('1')
  await expect(page.getByLabel('Area: which column?')).toHaveValue('2')
  await expect(page.getByLabel('Installed: which column?')).toHaveValue('')
  await page.getByRole('button', { name: 'Use “Install date”?' }).click()
  await shot(page, testInfo, 'match columns')
  await page.getByRole('button', { name: 'Next: review rows' }).click()

  // First the restaurant and the area; then the category, once its area is known.
  await expect(page.getByRole('heading', { name: 'Review 5 rows' })).toBeVisible()
  const ls = page.getByRole('region', { name: '“Federales LS” isn’t a restaurant name' })
  await expect(ls.getByRole('combobox')).toHaveValue('Federale’s Logan Square')
  await shot(page, testInfo, 'review')
  await ls.getByRole('button', { name: 'Apply to 2 rows' }).click()
  await expect(page.getByText('Set to Federale’s Logan Square · 2 rows ready')).toBeVisible()

  const area = page.getByRole('region', { name: 'Area is missing' })
  await area.getByRole('combobox').selectOption('Back of House')
  await area.getByRole('button', { name: 'Save' }).click()

  const lights = page.getByRole('region', { name: '“Lights” isn’t a Front of House category' })
  await expect(lights.getByRole('combobox')).toHaveValue('Lighting')
  await lights.getByRole('button', { name: 'Save' }).click()

  await page
    .getByRole('region', { name: '“Juggling” isn’t a Back of House category' })
    .getByRole('button', { name: 'Skip this row' })
    .click()

  const walkIn = page.getByRole('region', { name: 'Walk-in Cooler 1' })
  await expect(walkIn).toContainText('Row 4 · same name as a unit at Federale’s Logan Square')
  await walkIn.getByRole('radio', { name: 'Update existing' }).click()

  await page.getByRole('button', { name: 'Import 4 units' }).click()
  await expect(page.getByRole('heading', { name: '4 units imported' })).toBeVisible()
  await expect(page.getByText(/^Added\s*3$/)).toBeVisible()
  await expect(page.getByText(/^Updated\s*1$/)).toBeVisible()
  await expect(page.getByText(/^Skipped\s*1$/)).toBeVisible()
  await shot(page, testInfo, 'done')

  await page.getByRole('link', { name: 'View equipment' }).click()
  await expect(page).toHaveURL(/\/ops\/equipment$/)
  await page.getByRole('searchbox', { name: 'Search equipment' }).fill(r)
  await expect(page.getByText(`Bar fridge ${r}`)).toBeVisible()
  await expect(page.getByText(`Patio heater ${r}`)).toBeVisible()
  await expect(page.getByText(`Glass washer ${r}`)).toBeVisible()
  await expect(page.getByText(`Mystery box ${r}`)).toHaveCount(0)
})

test('one restaurant: Add equipment leads to the import with the picker’s restaurant, and no Restaurant column is needed', async ({
  page,
}) => {
  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/ops/equipment/new')
  await page.getByRole('link', { name: /Adding a lot of equipment\?/ }).click()
  await expect(page).toHaveURL(/\/ops\/equipment\/import/)
  const csv = ['Item,Area,Category', 'Spare blender,BOH,Cooking'].join('\n')
  await page
    .getByLabel('Spreadsheet to import')
    .setInputFiles({ name: 'porter.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Next: match columns' }).click()
  await expect(page.getByRole('button', { name: 'Next: review rows' })).toBeDisabled()
  await page.getByLabel('Or every row is at').selectOption({ label: 'Porter' })
  await expect(page.getByRole('button', { name: 'Next: review rows' })).toBeEnabled()
  await page.getByRole('button', { name: 'Next: review rows' }).click()
  await expect(page.getByText('Porter · BOH · Cooking')).toBeVisible()
  await page.getByRole('link', { name: 'Cancel import' }).click()
  await expect(page).toHaveURL(/\/ops\/equipment$/)
})
