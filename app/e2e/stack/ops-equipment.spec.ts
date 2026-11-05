import { expect, test, type Page } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Ops · Equipment list against the seed: Bert covers every restaurant and has See costs.
 * Other flows add tickets as they run, so the open counts are read as patterns.
 */

const BERT = 'bert.velilla@example.com'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

const group = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const head = (page: Page, name: string) => group(page, name).getByRole('button').first()
const row = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(`^${name}`) })

async function openEquipment(page: Page) {
  await signIn(page, BERT)
  await page.getByRole('link', { name: 'Equipment' }).click()
  await expect(page.getByRole('heading', { name: 'Equipment', level: 1 })).toBeVisible()
}

test('a card per type, one open at a time, each row with its restaurant, serial, spend and open tickets', async ({
  page,
}, testInfo) => {
  await openEquipment(page)
  await expect(page.getByRole('link', { name: 'Add equipment' })).toBeVisible()

  // Back of House types first, the first one open.
  const names = await page.getByRole('region').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(names.slice(0, 3)).toEqual(['Cooking', 'Refrigeration', 'Plumbing'])
  await expect(head(page, 'Cooking')).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'Combi Oven')).toBeVisible()

  await head(page, 'Refrigeration').click()
  await expect(head(page, 'Cooking')).toHaveAttribute('aria-expanded', 'false')
  await expect(row(page, 'Combi Oven')).toHaveCount(0)
  await expect(head(page, 'Refrigeration')).toContainText(/\d+ open/)

  const cooler = row(page, 'Walk-in Cooler 1')
  await expect(cooler).toContainText('Federale’s Logan Square')
  await expect(cooler).toContainText('Kolpak · KP-7XW-220418')
  await expect(cooler).toContainText(/\d+ open/)
  await expect(cooler).toContainText(/\$[\d,]+\.\d\d\s*spent in \d{4}|No cost\s*in \d{4}/)

  await page.waitForTimeout(300)
  await testInfo.attach('equipment list', { body: await page.screenshot(), contentType: 'image/png' })

  await cooler.click()
  await expect(page).toHaveURL(/\/ops\/equipment\/44444444-4444-4444-8444-000000000001$/)
})

test('search finds a name, brand or serial and opens every card it matches in', async ({ page }) => {
  await openEquipment(page)
  const search = page.getByRole('searchbox', { name: 'Search equipment' })

  await search.fill('kp7xw')
  await expect(row(page, 'Walk-in Cooler 1')).toBeVisible()
  await expect(page.getByRole('region')).toHaveCount(1)

  await search.fill('hobart')
  await expect(row(page, 'Dish Machine')).toHaveCount(2)

  await search.fill('ice machine')
  await expect(head(page, 'Refrigeration')).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'Ice Machine')).toHaveCount(3)

  await search.fill('nothing like this')
  await expect(page.getByText('No equipment matches “nothing like this”.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).last().click()
  await expect(search).toHaveValue('')
  await expect(head(page, 'Cooking')).toHaveAttribute('aria-expanded', 'true')
})

test('the filter sheet narrows by area and type, and each filter shows as a chip', async ({ page }, testInfo) => {
  await openEquipment(page)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Filter equipment' })
  await expect(sheet.getByText('Restaurant')).toHaveCount(0)

  await sheet.getByRole('radio', { name: 'Front of House' }).click()
  await expect(sheet.getByRole('button', { name: /^Show \d+ items?$/ })).toBeVisible()
  await page.waitForTimeout(250)
  await testInfo.attach('filter sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Plumbing' }).click()
  await sheet.getByRole('button', { name: /^Show \d+ items?$/ }).click()

  await expect(page.getByRole('button', { name: 'Filter · 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Front of House' })).toBeVisible()
  await expect(page.getByRole('region')).toHaveCount(1)
  await expect(row(page, 'Bar sink 2')).toBeVisible()
  await expect(row(page, 'Floor Drain Pump')).toHaveCount(0)

  await page.getByRole('button', { name: 'Remove Plumbing' }).click()
  await expect(page.getByRole('button', { name: 'Filter · 1' })).toBeVisible()
  await expect(group(page, 'Lighting')).toBeVisible()
  await expect(group(page, 'Cooking')).toHaveCount(0)
})

test('the picker narrows the list to one restaurant', async ({ page }) => {
  await openEquipment(page)
  await page.getByRole('button', { name: /All restaurants \(\d+\)/ }).click()
  await expect(page.getByText('Show equipment for')).toBeVisible()
  await page.getByRole('menuitemradio', { name: 'Porter' }).click()

  await page.getByRole('searchbox', { name: 'Search equipment' }).fill('dish')
  await expect(row(page, 'Dish Machine')).toHaveCount(1)
  await expect(row(page, 'Dish Machine')).toContainText('Porter')
  await expect(page.getByText('Federale’s Logan Square')).toHaveCount(0)
})

test('a unit added shows up, and once retired it is off the list', async ({ page, request }) => {
  const token = await tokenFor(request, BERT)
  const headers = { apikey: KEY, Authorization: `Bearer ${token}`, Prefer: 'return=representation' }
  const name = `Test unit ${Date.now()}`
  const added = await request.post(`${SUPABASE}/rest/v1/equipment`, {
    headers,
    data: {
      restaurant_id: '11111111-1111-4111-8111-000000000003',
      category_id: '33333333-3333-4333-8333-000000000016',
      name,
      brand: 'Hobart',
    },
  })
  expect(added.ok()).toBe(true)
  const [{ id }] = (await added.json()) as { id: string }[]

  await openEquipment(page)
  const search = page.getByRole('searchbox', { name: 'Search equipment' })
  await search.fill(name)
  await expect(row(page, name)).toContainText('Porter')
  await expect(row(page, name)).toContainText(/No cost\s*in \d{4}/)

  const retired = await request.post(`${SUPABASE}/rest/v1/rpc/set_equipment_retired`, {
    headers,
    data: { p_id: id, p_retired: true },
  })
  expect(retired.ok()).toBe(true)
  await page.reload()
  await page.getByRole('searchbox', { name: 'Search equipment' }).fill(name)
  await expect(page.getByText(`No equipment matches “${name}”.`)).toBeVisible()

  const deleted = await request.post(`${SUPABASE}/rest/v1/rpc/delete_equipment`, { headers, data: { p_id: id } })
  expect(deleted.ok()).toBe(true)
})

test('with no equipment it says so, and Add equipment stays in the header', async ({ page }, testInfo) => {
  await page.route('**/rest/v1/equipment*', (route) => route.fulfill({ json: [] }))
  await openEquipment(page)
  await expect(page.getByRole('heading', { name: 'No equipment yet' })).toBeVisible()
  await expect(page.getByText(/Nothing has been added across your \d+ restaurants/)).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search equipment' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Add equipment' })).toHaveCount(1)
  await testInfo.attach('no equipment', { body: await page.screenshot(), contentType: 'image/png' })
})
