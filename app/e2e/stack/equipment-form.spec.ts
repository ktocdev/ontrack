import { expect, test, type Page } from '@playwright/test'
import { bigPhoto, signIn, tokenFor } from './helpers'

/**
 * Add and Edit equipment, then Retire, Restore and Delete, against the seed. Units made
 * here are deleted at the end, so nothing is left for other flows to count. Bert is Ops
 * everywhere; Maya manages Logan Square with Add / edit equipment by override; Ari has
 * no such right. Walk-in Cooler 1 has tickets, so it can only be retired.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const COOLER = '44444444-4444-4444-8444-000000000001'
const PDF = { name: 'Hobart AM15 manual.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%test\n') }

async function fill(page: Page, name: string) {
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Brand').fill('Hobart')
  await page.getByLabel('Model').fill('AM15')
  await page.getByLabel('Serial number').fill('HB-TEST-0001')
  await page.getByLabel('Installed').fill('2026-10')
  await page.getByLabel(/Warranty through/).fill('2029-10')
}

async function rows(page: Page, request: import('@playwright/test').APIRequestContext, email: string, query: string) {
  const token = await tokenFor(request, email)
  const res = await request.get(`${SUPABASE}/rest/v1/${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
  return (await res.json()) as Record<string, unknown>[]
}

test('Ops adds a unit with a manual and a data plate photo, edits it, retires, restores and deletes it', async ({
  page,
  request,
}, testInfo) => {
  const name = `Test dish machine ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/ops/equipment')
  await page.getByRole('link', { name: 'Add equipment' }).click()
  await expect(page.getByRole('heading', { name: 'Add equipment' })).toBeVisible()
  await expect(page.getByText(/QR/)).toHaveCount(0)
  const save = page.getByRole('button', { name: 'Save equipment' })
  await expect(save).toBeDisabled()

  await page.getByLabel('Restaurant').selectOption({ label: 'Porter' })
  await expect(page.getByRole('radio', { name: 'Back of House' })).toHaveAttribute('aria-checked', 'true')
  await page.getByLabel('Category').selectOption({ label: 'Dishwashing' })
  await page.getByLabel('Location').fill('Dish pit')
  await fill(page, name)
  await page.getByLabel('Manual PDF').setInputFiles(PDF)
  await expect(page.getByText('Hobart AM15 manual.pdf')).toBeVisible()
  await page.getByLabel('Data plate photo').setInputFiles(await bigPhoto(page))
  await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('add equipment', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  await save.click()
  await expect(page).toHaveURL(/\/ops\/equipment\/[0-9a-f-]{36}$/)
  const id = new URL(page.url()).pathname.split('/').pop()!
  await expect(page.getByRole('status').filter({ hasText: `${name} added.` })).toBeVisible()
  const details = page.getByRole('region', { name: 'Details' })
  await expect(details).toContainText('Porter')
  await expect(details).toContainText('Back of House · Dishwashing')
  await expect(details).toContainText('Oct 2026')
  await expect(details).toContainText('Through Oct 2029')
  await expect(details.getByRole('link', { name: 'Hobart-AM15-manual.pdf' })).toHaveAttribute('href', /manuals/)
  await details.getByRole('button', { name: 'View photo' }).click()
  await expect(page.getByRole('dialog', { name: 'Photo' }).getByRole('img')).toBeVisible()
  await page.getByRole('dialog', { name: 'Photo' }).getByRole('button', { name: 'Close' }).click()

  const [saved] = await rows(
    page,
    request,
    'bert.velilla@example.com',
    `equipment?id=eq.${id}&select=installed_on,warranty_until,manual_path,plate_photo_path`,
  )
  expect(saved).toMatchObject({ installed_on: '2026-10-01', warranty_until: '2029-10-31' })
  expect(saved!.manual_path).toBe(`${id}/Hobart-AM15-manual.pdf`)
  expect(saved!.plate_photo_path).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}\\.jpg$`))

  // Edit: a new name, and the manual removed.
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit equipment' })).toBeVisible()
  await expect(page.getByLabel('Name')).toHaveValue(name)
  await expect(page.getByLabel('Restaurant')).toBeEnabled()
  await page.getByLabel('Name').fill(`${name} B`)
  await page.getByRole('button', { name: 'Remove manual' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/equipment/${id}$`))
  await expect(page.getByRole('heading', { name: `${name} B`, level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Details' })).not.toContainText('Manual')

  // Retire, with Delete offered since nothing points to it; then restore.
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Retire this equipment' }).click()
  const sheet = page.getByRole('dialog', { name: `Retire ${name} B?` })
  await expect(sheet.getByRole('button', { name: 'Delete instead' })).toBeEnabled()
  await page.waitForTimeout(250)
  await testInfo.attach('retire sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Retire equipment' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'retired.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore this equipment' })).toBeVisible()
  await page.goto(`/ops/equipment/${id}`)
  await expect(page.getByText('Retired', { exact: true })).toBeVisible()
  await page.goto('/ops/equipment')
  await page.getByRole('searchbox', { name: 'Search equipment' }).fill(`${name} B`)
  // Search finds it in the Retired card only (OT-71).
  await expect(page.getByRole('region')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Retired', exact: true })).toBeVisible()

  await page.goto(`/ops/equipment/${id}/edit`)
  await page.getByRole('button', { name: 'Restore this equipment' }).click()
  await page
    .getByRole('dialog', { name: `${name} B` })
    .getByRole('button', { name: 'Restore equipment' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: 'restored.' })).toBeVisible()

  // Delete: the unit and its photo go.
  await page.getByRole('button', { name: 'Retire this equipment' }).click()
  await page.getByRole('button', { name: 'Delete instead' }).click()
  await page
    .getByRole('dialog', { name: `Delete ${name} B?` })
    .getByRole('button', { name: 'Delete equipment' })
    .click()
  await expect(page).toHaveURL(/\/ops\/equipment$/)
  await expect(page.getByRole('status').filter({ hasText: 'deleted.' })).toBeVisible()
  expect(await rows(page, request, 'bert.velilla@example.com', `equipment?id=eq.${id}&select=id`)).toEqual([])
})

test('a unit with tickets stays at its restaurant and can only be retired', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await page.goto(`/ops/equipment/${COOLER}/edit`)
  await expect(page.getByLabel('Restaurant')).toBeDisabled()
  await expect(page.getByText('It has tickets or service here, so it stays at this restaurant.')).toBeVisible()
  await page.getByRole('button', { name: 'Retire this equipment' }).click()
  const sheet = page.getByRole('dialog', { name: 'Retire Walk-in Cooler 1?' })
  await expect(sheet.getByRole('button', { name: 'Delete instead' })).toBeDisabled()
  await expect(sheet).toContainText('It has tickets or service records, so it can only be retired.')
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toHaveCount(0)
})

test('a manager with Add / edit equipment adds at their restaurant', async ({ page, request }, testInfo) => {
  const name = `Test bar cooler ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'maya.reyes@example.com')
  await page.getByRole('link', { name: 'Equipment' }).click()
  await page.getByRole('link', { name: 'Add equipment' }).click()
  await expect(page.getByLabel('Restaurant')).toHaveCount(0)
  await page.getByRole('radio', { name: 'Front of House' }).click()
  await page.getByLabel('Category').selectOption({ label: 'Plumbing' })
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Save equipment' }).click()
  await expect(page).toHaveURL(/\/equipment\/[0-9a-f-]{36}$/)
  const id = new URL(page.url()).pathname.split('/').pop()!
  await expect(page.getByText('Federale’s Logan Square').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible()

  const token = await tokenFor(request, 'maya.reyes@example.com')
  const deleted = await request.post(`${SUPABASE}/rest/v1/rpc/delete_equipment`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    data: { p_id: id },
  })
  expect(deleted.ok()).toBe(true)
})

test('a manager without Add / edit equipment has no Edit and no way into the form', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/equipment/44444444-4444-4444-8444-000000000014')
  await expect(page.getByRole('heading', { name: 'Ice Machine', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0)
  await page.goto('/equipment/new')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
  await page.goto('/equipment/44444444-4444-4444-8444-000000000014/edit')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})
