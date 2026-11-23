import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { openRestaurants, signIn, tokenFor } from './helpers'

/**
 * Job titles (OT-117) against the seed: the migration's four titles, Maya a General
 * manager, Theo (Ops, all restaurants) IT. The list flow adds its own title, named for the
 * run, and deletes it again; Ari's restaurant already has him as its manager, so giving him a
 * title through set_person_access moves no restaurant's manager; giving Ari a title is put back, settings and all. The badge
 * flow puts Theo on the seed's POS ticket at West Loop, which no other flow counts.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const ARI = '22222222-2222-4222-8222-000000000002'
const POS_TICKET = '66666666-6666-4666-8666-000000001034'

const run = (name: string) => `${name === 'webkit' ? 'W' : 'C'}${Date.now() % 1_000_000}`

async function rest(request: APIRequestContext, email: string, path: string, init: { method?: string } = {}) {
  const token = await tokenFor(request, email)
  return request.fetch(`${SUPABASE}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
}

async function openJobTitles(page: Page) {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/users')
  await page.getByRole('link', { name: /^Job titles/ }).click()
  await expect(page.getByRole('heading', { name: 'Job titles', level: 1 })).toBeVisible()
}

test('an admin adds a job title with a starting view, turns it off and deletes it', async ({ page }, testInfo) => {
  const name = `Barback ${run(testInfo.project.name)}`
  await openJobTitles(page)
  await expect(page.getByRole('button', { name: /^Chef Front of House: Notify off · Hidden/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^General manager Starts with everything on/ })).toBeVisible()
  await testInfo.attach('job-titles', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Add job title' }).click()
  const add = page.getByRole('dialog', { name: 'Add job title' })
  await add.getByLabel('Name').fill(name)
  await add.getByRole('radiogroup', { name: 'IT: notify me' }).getByRole('radio', { name: 'Off' }).click()
  await add.getByRole('radiogroup', { name: 'IT: show on my lists' }).getByRole('radio', { name: 'Hidden' }).click()
  await testInfo.attach('add-job-title', { body: await page.screenshot(), contentType: 'image/png' })
  await add.getByRole('button', { name: 'Add job title' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} added.` })).toBeVisible()
  const row = page.getByRole('button', { name: new RegExp(`^${name} IT: Notify off · Hidden`) })
  await expect(row).toBeVisible()

  await row.click()
  const sheet = page.getByRole('dialog', { name })
  await expect(sheet.getByText('Nobody has it yet.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Turn off job title' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn off job title' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} turned off.` })).toBeVisible()
  await expect(page.getByText('Turned off', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete job title' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete job title' }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} deleted.` })).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toHaveCount(0)
})

test('a title someone has can be turned off but not deleted', async ({ page }) => {
  await openJobTitles(page)
  await page.getByRole('button', { name: /^IT / }).click()
  const sheet = page.getByRole('dialog', { name: 'IT' })
  await expect(sheet.getByRole('button', { name: 'Delete job title' })).toBeDisabled()
  await expect(sheet.getByText(/Someone has this title/)).toBeVisible()
})

test('giving a title shows it everywhere and starts the person on its view', async ({
  browser,
  page,
  request,
}, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.goto(`/admin/users/${ARI}`)
  await page.getByRole('button', { name: 'Change', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: "Change Ari's role" })
  await sheet.getByRole('button', { name: 'Chef', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save role' }).click()
  await expect(page.getByRole('status').filter({ hasText: "Ari's role saved." })).toBeVisible()

  try {
    await expect(page.getByText('Job title and role')).toBeVisible()
    await expect(page.getByText('Chef · Restaurant manager')).toBeVisible()
    await testInfo.attach('user-profile', { body: await page.screenshot(), contentType: 'image/png' })

    // The starting view is Ari's own settings now.
    const prefs = await rest(request, 'ari.kim@example.com', 'area_prefs?select=area,notify,shown')
    expect(await prefs.json()).toEqual([{ area: 'foh', notify: 'off', shown: false }])

    await page.goto('/admin/users')
    await expect(page.getByRole('link', { name: /^Ari Kim Chef/ })).toBeVisible()

    // Ari, on his own phone, sees it on Profile.
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      storageState: testInfo.project.use.storageState,
    })
    try {
      const ari = await context.newPage()
      await signIn(ari, 'ari.kim@example.com')
      await ari.goto('/profile')
      await expect(ari.getByText('Job title', { exact: true })).toBeVisible()
      await expect(ari.getByText('Chef', { exact: true })).toBeVisible()
    } finally {
      await context.close()
    }
  } finally {
    await page.goto(`/admin/users/${ARI}`)
    await page.getByRole('button', { name: 'Change', exact: true }).click()
    const back = page.getByRole('dialog', { name: "Change Ari's role" })
    await back.getByRole('button', { name: 'Chef', exact: true }).click()
    await back.getByRole('button', { name: 'Save role' }).click()
    await expect(page.getByRole('status').filter({ hasText: "Ari's role saved." })).toBeVisible()
    // Taking a title off leaves the settings, which are Ari's to change; put them back.
    await rest(request, 'ari.kim@example.com', 'area_prefs?user_id=not.is.null', { method: 'DELETE' })
  }
})

test('the badge naming who is on a ticket gives their title', async ({ page, request }) => {
  const token = await tokenFor(request, 'theo.grant@example.com')
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/set_ticket_status`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_id: POS_TICKET, p_status: 'in_progress' },
  })
  expect(res.ok()).toBe(true)

  await signIn(page, 'bert.velilla@example.com')
  await openRestaurants(page)
  await expect(
    page.getByRole('link', { name: /Bar POS won't print kitchen tickets/ }).getByText('Theo Grant · IT'),
  ).toBeVisible()
})

test('nobody but an admin gives a title, whatever the app shows', async ({ request }) => {
  const token = await tokenFor(request, 'bert.velilla@example.com')
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/add_job_title`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_name: 'Owner', p_view: {} },
  })
  expect(res.status()).toBe(403)
})
