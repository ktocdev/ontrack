import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test'
import { SEED_PASSWORD, signIn, tokenFor } from './helpers'

/**
 * Admin on any role (OT-123, the done test from OT-121). Rosa, the head ops manager, is on
 * the Support Team and holds Admin. She signs in with her code, reaches the admin view by
 * the shield on her dashboard, gives Chris Admin from his User profile, comes back by the
 * shield and takes a ticket under her own name. Chris is then asked to set up 2-step before
 * anything else. Chris is put back afterwards, since both browsers share one database.
 */

const ROSA = 'rosa.delgado@example.com'
const CHRIS = 'chris.novak@example.com'
const CHRIS_ID = '22222222-2222-4222-8222-000000000004'
const DANA = 'dana.ortiz@example.com'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

async function setChrisAdmin(request: APIRequestContext, on: boolean) {
  const res = await request.post(`${SUPABASE}/rest/v1/rpc/set_admin`, {
    headers: { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, ROSA)}` },
    data: { p_user: CHRIS_ID, p_on: on },
  })
  expect(res.ok()).toBe(true)
}

/** Dana files a Back of House ticket at Porter; its title back. */
async function newTicket(browser: Browser, testInfo: TestInfo) {
  const title = `Shelf ${testInfo.project.name} ${Date.now() % 100000}`
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, DANA)
  await dana.goto('/tickets/new?area=boh')
  await dana.getByRole('link', { name: /^Refrigeration/ }).click()
  await dana.getByLabel('Title').fill(title)
  await dana.getByRole('button', { name: 'Submit ticket' }).click()
  await dana.getByRole('button', { name: 'Proceed without photo' }).click()
  await expect(dana.getByRole('link', { name: new RegExp(title) })).toBeVisible()
  await context.close()
  return title
}

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

test.afterEach(({ request }) => setChrisAdmin(request, false))

test('the head ops manager reaches the admin view by the shield, gives Admin, and works a ticket as herself', async ({
  browser,
  page,
}, testInfo) => {
  const title = await newTicket(browser, testInfo)

  // Her home is the Support Team's dashboard, with the shield beside her avatar.
  await signIn(page, ROSA)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Operations' })).toBeVisible()
  const shield = page.getByRole('link', { name: 'Admin', exact: true })
  await expect(shield).toBeVisible()
  await shot(page, testInfo, 'dashboard-with-shield')

  // The admin view has its own tab bar, with no Tickets tab, and the shield filled.
  await shield.click()
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  const tabs = page.getByRole('navigation', { name: 'Admin' })
  await expect(tabs.getByRole('link')).toHaveText(['Users', 'Roles & rights', 'Restaurants'])
  await expect(page.getByRole('link', { name: 'Leave admin' })).toBeVisible()
  await shot(page, testInfo, 'admin-view')

  // Admin is given from User profile, with a sheet that says what it means.
  await page.getByRole('link', { name: /Chris Novak/ }).click()
  const adminSwitch = page.getByRole('switch', { name: 'Admin' })
  await expect(adminSwitch).not.toBeChecked()
  await adminSwitch.click()
  const sheet = page.getByRole('dialog', { name: 'Give Chris Admin?' })
  await expect(sheet).toContainText('sets up 2-step verification')
  await shot(page, testInfo, 'give-admin')
  await sheet.getByRole('button', { name: 'Give Admin' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Chris is now an admin.' })).toBeVisible()
  await expect(adminSwitch).toBeChecked()
  await expect(page.getByText('Not set up · required at next sign-in')).toBeVisible()
  // Nobody holding Admin is viewed as.
  await expect(page.getByRole('link', { name: /View as Chris/ })).toHaveCount(0)

  // Back to Users, where Chris now carries the Admin tag, then home by the shield.
  await page.getByRole('link', { name: 'Back to users' }).click()
  await expect(page.getByRole('link', { name: /Chris Novak/ })).toContainText('Admin')
  await page.getByRole('link', { name: 'Leave admin' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Operations' })).toBeVisible()

  // She works a ticket as the Support Team does, under her own name.
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await page.getByRole('button', { name: /^Status/ }).click()
  await page.getByRole('menuitemradio', { name: 'In progress' }).click()
  await expect(page.getByText('On it', { exact: true }).locator('..')).toContainText('You')
  await expect(page.getByText(/^You took this · status In progress · /)).toBeVisible()

  // Chris, holding Admin now, sets up 2-step before anything else.
  const context = await browser.newContext({ ...testInfo.project.use, serviceWorkers: 'block' })
  const chris = await context.newPage()
  await chris.goto('/sign-in')
  await chris.getByLabel('Work email').fill(CHRIS)
  await chris.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
  await chris.getByRole('button', { name: 'Sign in' }).click()
  await expect(chris.getByRole('heading', { name: 'Turn on 2-step verification' })).toBeVisible()
  await context.close()
})

test('the plain Admin account keeps its own tabs, with no shield', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link')).toHaveText([
    'Users',
    'Roles & rights',
    'Tickets',
    'Restaurants',
  ])
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
})

test('the rest of the Support Team has no shield, and the admin screens are closed to them', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: "You don't have access to the admin screens" })).toBeVisible()
})
