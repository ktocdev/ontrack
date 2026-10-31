import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Roles & rights, User profile and View as. The second half of the Phase 1 done
 * test is here: granting see_costs to a manager changes what the database returns,
 * with no app change. Everything changed on a seeded person is put back.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

const MAYA = '22222222-2222-4222-8222-000000000001'
const CHRIS = '22222222-2222-4222-8222-000000000004'
const ADMIN = '22222222-2222-4222-8222-000000000006'

async function rowsAs(request: APIRequestContext, email: string, table: string) {
  const token = await tokenFor(request, email)
  const res = await request.get(`${SUPABASE}/rest/v1/${table}?select=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
  return ((await res.json()) as unknown[]).length
}

test('the grid shows the defaults, and a change reaches can() once confirmed', async ({ page, request }, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/roles')
  await expect(page.getByRole('heading', { name: 'Roles & rights' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'See contractors & invoices' })).toBeVisible()
  await page.getByRole('button', { name: 'Help' }).click()
  await expect(page.getByText('Only the restaurants assigned to them')).toBeVisible()
  await testInfo.attach('roles', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('link', { name: 'Edit defaults' }).click()
  const save = page.getByRole('button', { name: 'Save changes' })
  await expect(save).toBeDisabled()

  // Locked, here and in the database (13_rights_and_people.test.sql).
  await expect(page.getByRole('button', { name: 'See costs, Admin: Yes, locked' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )

  // Ari has no override for this, so the role default decides.
  expect(await rowsAs(request, 'ari.kim@example.com', 'service_records')).toBe(0)
  await page.getByRole('button', { name: 'See costs, Mgr: No, tap to change' }).click()
  await page.getByRole('button', { name: 'See tickets, Mgr: Own, tap to change' }).click()
  await page.getByRole('button', { name: 'See tickets, Mgr: All, tap to change' }).click() // changed back
  await page.getByRole('button', { name: 'Save 1 change' }).click()

  const sheet = page.getByRole('dialog', { name: /Update defaults for \d+ (person|people)\?/ })
  await expect(sheet.getByText('See costs · Mgr')).toBeVisible()
  await expect(sheet.getByText('No → Yes')).toBeVisible()
  await page.waitForTimeout(400) // let the sheet finish sliding up
  await testInfo.attach('roles-confirm', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Save defaults' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Defaults updated.' })).toBeVisible()

  try {
    expect(await rowsAs(request, 'ari.kim@example.com', 'service_records')).toBeGreaterThan(0)
  } finally {
    await page.getByRole('link', { name: 'Edit defaults' }).click()
    await page.getByRole('button', { name: 'See costs, Mgr: Yes, tap to change' }).click()
    await page.getByRole('button', { name: 'Save 1 change' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Save defaults' }).click()
    await expect(page).toHaveURL(/\/admin\/roles$/)
  }
  expect(await rowsAs(request, 'ari.kim@example.com', 'service_records')).toBe(0)
})

test('Phase 1 done: one person’s override changes what the database returns', async ({ page, request }, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/users')
  await page.getByRole('link', { name: /Maya Reyes/ }).click()
  await expect(page.getByRole('heading', { name: 'Maya Reyes' })).toBeVisible()
  await expect(page.getByText('2 rights')).toBeVisible()
  await testInfo.attach('user-profile', { body: await page.screenshot(), contentType: 'image/png' })

  const save = page.getByRole('button', { name: 'Save changes' })
  await expect(save).toBeDisabled()
  const before = await rowsAs(request, 'maya.reyes@example.com', 'service_records')
  expect(before).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Reset See costs to role default' }).click()
  await save.click()
  await expect(page.getByRole('status').filter({ hasText: "Maya's rights saved." })).toBeVisible()
  expect(await rowsAs(request, 'maya.reyes@example.com', 'service_records')).toBe(0)
  await expect(page.getByText('1 right')).toBeVisible()

  await page.getByRole('switch', { name: 'See costs' }).click()
  await expect(page.getByRole('button', { name: 'Reset See costs to role default' })).toBeVisible()
  await save.click()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  // The button is also disabled while saving, so this waits for the result.
  await expect.poll(() => rowsAs(request, 'maya.reyes@example.com', 'service_records')).toBe(before)
})

test('a role can change, and so does what comes with it', async ({ page, request }) => {
  await signIn(page, 'admin@example.com')
  await page.goto(`/admin/users/${CHRIS}`)
  await expect(page.getByText('Operations manager')).toBeVisible()
  await page.getByRole('button', { name: 'Change', exact: true }).click()

  const sheet = page.getByRole('dialog', { name: "Change Chris's role" })
  await sheet.getByRole('radio', { name: /Restaurant manager/ }).click()
  // A manager can't have the all-restaurants scope, so they must pick one.
  await expect(sheet.getByRole('button', { name: 'Save role' })).toBeDisabled()
  await sheet.getByRole('button', { name: 'Porter' }).click()
  await sheet.getByRole('button', { name: 'Save role' }).click()
  await expect(page.getByRole('status').filter({ hasText: "Chris's role saved." })).toBeVisible()
  await expect(page.getByText('Restaurant manager')).toBeVisible()

  try {
    const token = await tokenFor(request, 'chris.novak@example.com')
    const res = await request.get(`${SUPABASE}/rest/v1/restaurants?select=name`, {
      headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    })
    expect(await res.json()).toEqual([{ name: 'Porter' }])
  } finally {
    await page.getByRole('button', { name: 'Change', exact: true }).click()
    const back = page.getByRole('dialog', { name: "Change Chris's role" })
    await back.getByRole('radio', { name: /Operations manager/ }).click()
    await back.getByRole('button', { name: 'Porter' }).click()
    await back.getByRole('button', { name: 'All restaurants' }).click()
    await back.getByRole('button', { name: 'Save role' }).click()
    await expect(page.getByText('All restaurants', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Operations manager')).toBeVisible()
  }
})

test('deactivating stops sign-in and refresh, and reactivating restores them', async ({ page, request }) => {
  const live = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    data: { email: 'chris.novak@example.com', password: 'ontrack-demo-2026' },
    headers: { apikey: KEY },
  })
  const { refresh_token } = (await live.json()) as { refresh_token: string }

  await signIn(page, 'admin@example.com')
  await page.goto(`/admin/users/${CHRIS}`)
  await page.getByRole('button', { name: 'Deactivate Chris' }).click()
  await page
    .getByRole('dialog', { name: 'Deactivate Chris?' })
    .getByRole('button', { name: 'Deactivate Chris' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: 'Chris deactivated.' })).toBeVisible()
  await expect(page.getByText("Chris is deactivated and can't sign in.")).toBeVisible()

  try {
    expect(await tokenFor(request, 'chris.novak@example.com')).toBeUndefined()
    await page.goto('/admin/users')
    await expect(page.getByRole('link', { name: /Chris Novak/ }).getByText('Deactivated')).toBeVisible()
    await page.goto(`/admin/users/${CHRIS}`)
  } finally {
    await page.getByRole('button', { name: 'Reactivate Chris' }).click()
    await page
      .getByRole('dialog', { name: 'Reactivate Chris?' })
      .getByRole('button', { name: 'Reactivate Chris' })
      .click()
    await expect(page.getByRole('status').filter({ hasText: 'Chris reactivated.' })).toBeVisible()
  }
  expect(await tokenFor(request, 'chris.novak@example.com')).toBeTruthy()

  // A session from before is over for good, not just paused while the ban lasted.
  const refreshed = await request.post(`${SUPABASE}/auth/v1/token?grant_type=refresh_token`, {
    data: { refresh_token },
    headers: { apikey: KEY },
  })
  expect(refreshed.ok()).toBe(false)
})

test('an account with no history can be deleted, and one with history cannot', async ({ page, request }, testInfo) => {
  const email = `delete.me.${testInfo.project.name}.${Date.now() % 1_000_000}@example.com`
  const admin = await tokenFor(request, 'admin@example.com')
  const sent = await request.post(`${SUPABASE}/functions/v1/invite-user`, {
    data: { action: 'send', full_name: 'Delete Me', email, role: 'ops', restaurant_ids: [] },
    headers: { apikey: KEY, Authorization: `Bearer ${admin}` },
  })
  expect(sent.status()).toBe(200)

  let token = ''
  await expect(async () => {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${email}"` } })
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)
    token = /\/invite#(\S+)/.exec(((await message.json()) as { Text: string }).Text)![1]!
  }).toPass({ timeout: 15_000 })
  const password = 'Kitchen4-kitchen'
  const accepted = await request.post(`${SUPABASE}/functions/v1/invite-user`, {
    data: { action: 'accept', token, full_name: 'Delete Me', password },
    headers: { apikey: KEY },
  })
  expect(accepted.status()).toBe(200)

  await signIn(page, 'admin@example.com')
  await page.goto('/admin/users')
  await page
    .getByRole('link', { name: /Delete Me/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Delete account' }).click()
  await page
    .getByRole('dialog', { name: "Delete Delete's account?" })
    .getByRole('button', { name: 'Delete account' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: "Delete's account deleted." })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/users$/)
  expect(await tokenFor(request, email, password)).toBeUndefined()

  // Bert has worked tickets.
  await page.goto('/admin/users')
  await page.getByRole('link', { name: /Bert Velilla/ }).click()
  await expect(page.getByRole('button', { name: 'Delete account' })).toBeDisabled()
  await expect(page.getByText('so this account can only be deactivated')).toBeVisible()

  const bert = await request.post(`${SUPABASE}/functions/v1/revoke-user`, {
    data: { action: 'delete', user_id: '22222222-2222-4222-8222-000000000003' },
    headers: { apikey: KEY, Authorization: `Bearer ${admin}` },
  })
  expect(await bert.json()).toEqual({ error: 'has_history' })
})

test('View as shows their home under the banner, cannot navigate away, and is logged', async ({
  page,
  request,
}, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/admin/users/${MAYA}`)
  await page.getByRole('link', { name: 'View as Maya' }).click()

  await expect(page.getByText('Viewing as Maya Reyes')).toBeVisible()
  await expect(page.getByText("nothing you tap changes Maya's data")).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
  await expect(page.getByText('Federale’s Logan Square')).toBeVisible()
  await testInfo.attach('view-as', { body: await page.screenshot(), contentType: 'image/png' })

  const nav = page.getByRole('navigation', { name: 'Manager' })
  await expect(nav.getByText('Equipment')).toBeVisible()
  await expect(nav.getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Your profile' })).toHaveCount(0)

  const admin = await tokenFor(request, 'admin@example.com')
  const log = await request.get(
    `${SUPABASE}/rest/v1/audit_log?action=eq.view_as.start&target_user_id=eq.${MAYA}&actor_id=eq.${ADMIN}&select=id`,
    { headers: { apikey: KEY, Authorization: `Bearer ${admin}` } },
  )
  expect(((await log.json()) as unknown[]).length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Report a problem to support' }).click()
  await expect(page.getByRole('dialog', { name: 'Report a problem' }).getByText('Viewing as Maya Reyes')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('link', { name: 'Exit' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/users/${MAYA}$`))

  // Not an admin, and not yourself.
  await page.goto(`/admin/users/${ADMIN}`)
  await expect(page.getByRole('link', { name: /View as/ })).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'See costs' })).toBeDisabled()
  await page.goto(`/admin/users/${ADMIN}/view`)
  await expect(page.getByText('Viewing as')).toHaveCount(0)
})

test('a manager is refused by the database, whatever the app shows', async ({ request }) => {
  const token = await tokenFor(request, 'ari.kim@example.com')
  const rpc = (name: string, data: object) =>
    request.post(`${SUPABASE}/rest/v1/rpc/${name}`, {
      data,
      headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    })
  expect((await rpc('save_role_defaults', { p_changes: [] })).status()).toBe(403)
  expect((await rpc('set_person_rights', { p_user: MAYA, p_rights: [] })).status()).toBe(403)
  expect((await rpc('set_person_access', { p_user: MAYA, p_role: 'ops', p_restaurants: [] })).status()).toBe(403)
  expect((await rpc('log_view_as', { p_user: MAYA })).status()).toBe(403)
  const remove = await request.post(`${SUPABASE}/functions/v1/revoke-user`, {
    data: { action: 'delete', user_id: MAYA },
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
  expect(remove.status()).toBe(403)
})
