import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { SEED_PASSWORD, signIn, tokenFor } from './helpers'

/**
 * A unit's lasting link, Share link, Create ticket for this equipment and the Retired card
 * (OT-71), against the seed: Walk-in Cooler 1 is at Federale's Logan Square, Maya's
 * restaurant; the Espresso Machine is at Ranalli's, Ari's. Tickets are never deleted, so
 * the one made here is Ari's, which no other test counts.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const COOLER = '44444444-4444-4444-8444-000000000001'
const ESPRESSO = '44444444-4444-4444-8444-000000000005'
const LOGAN_SQUARE = '11111111-1111-4111-8111-000000000001'
const RANALLIS = '11111111-1111-4111-8111-000000000004'
const menu = (page: Page) => page.getByRole('button', { name: 'More options for this equipment' })
const group = (page: Page, name: string) => page.getByRole('region', { name, exact: true })

async function signInForm(page: Page, email: string) {
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('the link opens the unit for a manager and for Ops', async ({ page, browser }, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/e/${COOLER}`)
  await expect(page).toHaveURL(new RegExp(`/equipment/${COOLER}$`))
  await expect(page.getByRole('heading', { name: 'Walk-in Cooler 1', level: 1 })).toBeVisible()

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const ops = await context.newPage()
  await signIn(ops, 'bert.velilla@example.com')
  await ops.goto(`/e/${COOLER}`)
  await expect(ops).toHaveURL(new RegExp(`/ops/equipment/${COOLER}$`))
  await expect(ops.getByRole('heading', { name: 'Walk-in Cooler 1', level: 1 })).toBeVisible()
  await context.close()
})

test('a signed-out person goes through sign-in and back to the unit', async ({ page }) => {
  await page.goto(`/e/${COOLER}`)
  await signInForm(page, 'bert.velilla@example.com')
  await expect(page).toHaveURL(new RegExp(`/ops/equipment/${COOLER}$`))
  await expect(page.getByRole('heading', { name: 'Walk-in Cooler 1', level: 1 })).toBeVisible()
})

test('the link grants nothing: another restaurant’s manager is refused, and leadership has no screen', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto(`/e/${COOLER}`)
  await signInForm(page, 'dana.ortiz@example.com')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
  await expect(page.getByText('Walk-in Cooler 1')).toHaveCount(0)

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const lead = await context.newPage()
  await lead.goto(`/e/${COOLER}`)
  await signInForm(lead, 'lee.chen@example.com')
  await expect(lead.getByRole('heading', { name: "Equipment doesn't open here" })).toBeVisible()
  await expect(lead.getByText('Walk-in Cooler 1')).toHaveCount(0)
  await context.close()
})

test('Share link copies the unit’s link on a computer', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          ;(window as unknown as { copied?: string }).copied = text
          return Promise.resolve()
        },
      },
    })
  })
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/equipment/${COOLER}`)
  await menu(page).click()
  await page.waitForTimeout(200)
  await testInfo.attach('menu', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('menuitem', { name: 'Share link' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Link copied.' })).toBeVisible()
  const origin = new URL(page.url()).origin
  expect(await page.evaluate(() => (window as unknown as { copied?: string }).copied)).toBe(`${origin}/e/${COOLER}`)
})

test('a manager creates a ticket from a unit with the unit filled in, and it shows on the unit', async ({
  page,
}, testInfo) => {
  const title = `Grinder jammed ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.goto(`/equipment/${ESPRESSO}`)
  await page.waitForTimeout(300)
  await testInfo.attach('unit', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('link', { name: 'Create ticket for this equipment' }).click()

  await expect(page.getByRole('heading', { name: 'New ticket' })).toBeVisible()
  const unit = page.getByRole('radiogroup', { name: 'Equipment' }).getByRole('radio', { name: /Espresso Machine/ })
  await expect(unit).toHaveAttribute('aria-checked', 'true')
  await page.waitForTimeout(300)
  await testInfo.attach('form', { body: await page.screenshot(), contentType: 'image/png' })

  // Back returns to the unit, not to the categories.
  await page.getByRole('link', { name: 'Back to equipment' }).click()
  await expect(page).toHaveURL(new RegExp(`/equipment/${ESPRESSO}$`))
  await page.getByRole('link', { name: 'Create ticket for this equipment' }).click()

  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await page
    .getByRole('dialog', { name: 'Add a photo?' })
    .getByRole('button', { name: 'Proceed without photo' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: /OT-\d+ created\./ })).toBeVisible()

  await page.goto(`/equipment/${ESPRESSO}/tickets`)
  await expect(
    page.getByRole('region', { name: 'Open tickets' }).getByRole('link', { name: new RegExp(title) }),
  ).toBeVisible()
})

test('Ops has Share link on a unit but no Create ticket', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await page.goto(`/ops/equipment/${COOLER}`)
  await expect(menu(page)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create ticket for this equipment' })).toHaveCount(0)
})

async function retiredUnit(request: APIRequestContext, name: string, restaurantId: string) {
  const token = await tokenFor(request, 'bert.velilla@example.com')
  const headers = { apikey: KEY, Authorization: `Bearer ${token}`, Prefer: 'return=representation' }
  const added = await request.post(`${SUPABASE}/rest/v1/equipment`, {
    headers,
    data: { restaurant_id: restaurantId, category_id: '33333333-3333-4333-8333-000000000012', name },
  })
  expect(added.ok()).toBe(true)
  const [{ id }] = (await added.json()) as { id: string }[]
  const retired = await request.post(`${SUPABASE}/rest/v1/rpc/set_equipment_retired`, {
    headers,
    data: { p_id: id, p_retired: true },
  })
  expect(retired.ok()).toBe(true)
  return {
    id,
    remove: async () => {
      const deleted = await request.post(`${SUPABASE}/rest/v1/rpc/delete_equipment`, { headers, data: { p_id: id } })
      expect(deleted.ok()).toBe(true)
    },
  }
}

test('a retired unit sits in a closed Retired card on both lists, where search finds it, and has no Create ticket', async ({
  page,
  browser,
  request,
  browserName,
}, testInfo) => {
  const name = `Old reach-in ${browserName}`
  const unit = await retiredUnit(request, name, LOGAN_SQUARE)
  const atAri = await retiredUnit(request, `Spare reach-in ${browserName}`, RANALLIS)
  try {
    await signIn(page, 'bert.velilla@example.com')
    await page.getByRole('link', { name: 'Equipment' }).click()
    await expect(page.getByRole('heading', { name: 'Equipment', level: 1 })).toBeVisible()
    const retired = group(page, 'Retired')
    await expect(retired.getByRole('button').first()).toHaveAttribute('aria-expanded', 'false')
    await expect(retired.getByRole('button').first()).toContainText(/Retired\s*\d+/)
    await retired.getByRole('button').first().click()
    await expect(retired.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible()
    await page.waitForTimeout(300)
    await testInfo.attach('ops-retired', { body: await page.screenshot(), contentType: 'image/png' })
    await retired.getByRole('button').first().click()

    await page.getByRole('searchbox').fill(name)
    await expect(retired.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible()
    await expect(group(page, 'Refrigeration')).toHaveCount(0)

    // A manager with Add / edit equipment sees it under Back of House; one without (Ari, with
    // one retired at his own restaurant) sees no Retired card.
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
    const maya = await context.newPage()
    await signIn(maya, 'maya.reyes@example.com')
    await maya.goto('/equipment')
    await maya.getByRole('radio', { name: 'Back of House' }).click()
    await group(maya, 'Retired').getByRole('button').first().click()
    await group(maya, 'Retired')
      .getByRole('link', { name: new RegExp(`^${name}`) })
      .click()
    await expect(maya.getByText('Retired', { exact: true })).toBeVisible()
    await expect(maya.getByRole('link', { name: 'Create ticket for this equipment' })).toHaveCount(0)
    await context.close()

    const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
    const ari = await other.newPage()
    await signIn(ari, 'ari.kim@example.com')
    await ari.goto('/equipment')
    await ari.getByRole('radio', { name: 'Back of House' }).click()
    await expect(ari.getByRole('button', { name: /Refrigeration/ })).toBeVisible()
    await expect(group(ari, 'Retired')).toHaveCount(0)
    await other.close()
  } finally {
    await unit.remove()
    await atAri.remove()
  }
})
