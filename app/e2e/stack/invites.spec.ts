import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * The Phase 1 done test: an admin invites a manager, the manager sets up the
 * account from the email and lands in their own restaurant. Email goes to the
 * local stack's Mailpit inbox, so the test opens the real link from a real
 * message. Every run invites its own address, so it needs no clean up beyond the
 * pending invites it revokes.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const NEW_PASSWORD = 'Kitchen4-kitchen'

/** The link in the newest email to this address; waits for it to arrive. */
async function inviteLink(request: APIRequestContext, to: string) {
  let link = ''
  await expect(async () => {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}"` } })
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    expect(messages.length).toBeGreaterThan(0)
    const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)
    const { Text } = (await message.json()) as { Text: string }
    link = /https?:\/\/\S+\/invite#\S+/.exec(Text)?.[0] ?? ''
    expect(link).not.toBe('')
  }).toPass({ timeout: 15_000 })
  return link
}

const unique = (name: string, testInfo: { project: { name: string } }) =>
  `${name}.${testInfo.project.name}.${Date.now() % 1_000_000}@example.com`

// Ranalli's already has a manager, so nobody who accepts here changes what the
// Restaurants tests see (a restaurant with no manager would take them on).
const RESTAURANT = 'Ranalli’s Logan Square'

async function invite(page: Page, name: string, email: string) {
  await page.goto('/admin/users/new')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Work email').fill(email)
  await page.getByRole('button', { name: RESTAURANT }).click()
  await page.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByRole('status').filter({ hasText: `Invite sent to ${name}.` })).toBeVisible()
}

test('an admin invites a manager, who sets up the account and lands in their restaurant', async ({
  browser,
  page,
  request,
}, testInfo) => {
  const email = unique('new.manager', testInfo)
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/users/new')
  await expect(page.getByRole('heading', { name: 'Invite a user' })).toBeVisible()
  await testInfo.attach('invite-user', { body: await page.screenshot(), contentType: 'image/png' })
  await invite(page, 'Nina Manager', email)

  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByText('Invite pending · sent today').first()).toBeVisible()
  await testInfo.attach('users', { body: await page.screenshot(), contentType: 'image/png' })

  // A second phone: nobody signed in, opening the link from the email.
  const phone = await browser.newContext({ ...testInfo.project.use, serviceWorkers: 'block' })
  const manager = await phone.newPage()
  await manager.goto(await inviteLink(request, email))
  await expect(manager.getByRole('heading', { name: 'Set up your account' })).toBeVisible()
  await expect(manager.getByText(`Restaurant manager · ${RESTAURANT}`)).toBeVisible()
  await expect(manager.getByLabel('Email')).toHaveValue(email)
  await expect(manager.getByLabel('Your name')).toHaveValue('Nina Manager')

  const create = manager.getByRole('button', { name: 'Create account' })
  await expect(create).toBeDisabled()
  await manager.getByLabel('Create password').fill('kitchen4')
  await testInfo.attach('set-up-account', { body: await manager.screenshot(), contentType: 'image/png' })
  await manager.getByLabel('Create password').fill(NEW_PASSWORD)
  await manager.getByLabel('Confirm password').fill('not the same')
  await expect(manager.getByText("Doesn't match the password above.")).toBeVisible()
  await expect(create).toBeDisabled()
  await manager.getByLabel('Confirm password').fill(NEW_PASSWORD)
  await create.click()

  // Signed in, on the manager home, scoped to the restaurant from the invite.
  await expect(manager).toHaveURL(/\/tickets$/)
  await expect(manager.getByText(RESTAURANT).first()).toBeVisible()
  await expect(manager.getByRole('navigation', { name: 'Manager' })).toBeVisible()
  await testInfo.attach('manager-home', { body: await manager.screenshot(), contentType: 'image/png' })

  // The token that claimed the invite did not stay on the account.
  const signedIn = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    data: { email, password: NEW_PASSWORD },
    headers: { apikey: KEY },
  })
  const { user } = (await signedIn.json()) as { user: { user_metadata: Record<string, unknown> } }
  expect(user.user_metadata.full_name).toBe('Nina Manager')
  expect(user.user_metadata.invite_token).toBeUndefined()

  // The link is spent.
  const spent = await inviteLink(request, email)
  await manager.goto(spent)
  await expect(manager.getByRole('heading', { name: 'This invite was already used' })).toBeVisible()
  await phone.close()

  // The admin now sees a person, not an invite.
  await page.reload()
  await expect(page.getByRole('link', { name: /Nina Manager/ }).first()).toBeVisible()
})

test('resending replaces the link and revoking kills it', async ({ page, request }, testInfo) => {
  const email = unique('resent', testInfo)
  const name = `Resent ${testInfo.project.name}`
  await signIn(page, 'admin@example.com')
  await invite(page, name, email)
  const first = await inviteLink(request, email)

  await page.getByRole('button', { name: `${name}, invite options` }).click()
  const sheet = page.getByRole('dialog', { name })
  await expect(sheet.getByText(email)).toBeVisible()
  await page.waitForTimeout(400) // let the sheet finish sliding up
  await testInfo.attach('invite-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Resend invite' }).click()
  await expect(page.getByRole('status').filter({ hasText: `Invite sent again to ${name}.` })).toBeVisible()

  await expect.poll(() => inviteLink(request, email)).not.toBe(first)
  const second = await inviteLink(request, email)
  await page.goto(first)
  await expect(page.getByRole('heading', { name: "This invite link isn't valid" })).toBeVisible()

  await page.goto('/admin/users')
  await page.getByRole('button', { name: `${name}, invite options` }).click()
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Revoke invite' }).click()
  await page
    .getByRole('dialog', { name: `Revoke ${name}'s invite?` })
    .getByRole('button', { name: 'Revoke invite' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: `${name}'s invite revoked.` })).toBeVisible()
  await expect(page.getByRole('button', { name: `${name}, invite options` })).toBeHidden()

  await page.goto(second)
  await expect(page.getByRole('heading', { name: "This invite link isn't valid" })).toBeVisible()
})

test('an invite that is taken or still pending says so on the field', async ({ page }) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/users/new')
  await page.getByLabel('Full name').fill('Maya Again')
  await page.getByRole('button', { name: 'Federale’s West Loop' }).click()
  await page.getByLabel('Work email').fill('maya.reyes@example.com')
  await page.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByText('Someone with this email already has an account.')).toBeVisible()
  await page.getByLabel('Work email').fill('sam.patel@example.com')
  await page.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByText('This person already has a pending invite.')).toBeVisible()
})

test('the list shows pending, expired and active people, and the filters work', async ({ page }, testInfo) => {
  await signIn(page, 'admin@example.com')
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  await expect(page.getByText('4C | Four Corners')).toBeVisible()
  await expect(page.getByText('Invite expired · Oct 10')).toBeVisible() // Jordan Blake
  await expect(page.getByRole('link', { name: /Maya Reyes/ })).toBeVisible()
  await testInfo.attach('users-list', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: /^Pending/ }).click()
  await expect(page.getByRole('link', { name: /Maya Reyes/ })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Sam Patel, invite options' })).toBeVisible()

  await page.getByRole('button', { name: 'Ops', exact: true }).click()
  await expect(page.getByRole('link', { name: /Bert Velilla/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sam Patel, invite options' })).toBeHidden()
})

test('an expired link can ask for a new invite', async ({ page }, testInfo) => {
  // Jordan Blake's seeded invite expired on Oct 10; its token is in seed.sql.
  await page.goto('/invite#seed-token-jordan')
  await expect(page.getByRole('heading', { name: 'This invite has expired' })).toBeVisible()
  await expect(page.getByText('Invites last 72 hours.')).toBeVisible()
  await testInfo.attach('link-expired', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('button', { name: 'Ask admin for a new invite' }).click()
  await expect(page.getByRole('button', { name: 'Request sent' })).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'We let your admin know.' })).toBeVisible()
  await testInfo.attach('link-expired-sent', { body: await page.screenshot(), contentType: 'image/png' })
})

test('a link that was never real gets no form', async ({ page }) => {
  await page.goto('/invite#not-a-real-token-at-all')
  await expect(page.getByRole('heading', { name: "This invite link isn't valid" })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeHidden()
  await page.goto('/invite')
  await expect(page.getByRole('heading', { name: "This invite link isn't valid" })).toBeVisible()
})

test.describe('the functions refuse what the screens would never send', () => {
  const call = (request: APIRequestContext, name: string, data: object, token?: string) =>
    request.post(`${SUPABASE}/functions/v1/${name}`, {
      data,
      headers: { apikey: KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })

  async function tokenFor(request: APIRequestContext, email: string) {
    const res = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
      data: { email, password: 'ontrack-demo-2026' },
      headers: { apikey: KEY },
    })
    return ((await res.json()) as { access_token: string }).access_token
  }

  const base = { action: 'send', full_name: 'Nobody', email: 'nobody@example.com', role: 'ops', restaurant_ids: [] }

  test('signed out, or without invite_users, nobody can invite or revoke', async ({ request }) => {
    expect((await call(request, 'invite-user', base)).status()).toBe(401)
    const maya = await tokenFor(request, 'maya.reyes@example.com')
    expect((await call(request, 'invite-user', base, maya)).status()).toBe(403)
    expect((await call(request, 'invite-user', { ...base, role: 'admin' }, maya)).status()).toBe(403)
    const revoke = { action: 'revoke_invite', invite_id: '88888888-8888-4888-8888-000000000001' }
    expect((await call(request, 'revoke-user', revoke)).status()).toBe(401)
    expect((await call(request, 'revoke-user', revoke, maya)).status()).toBe(403)
  })

  test('an admin still cannot break the rules', async ({ request }) => {
    const admin = await tokenFor(request, 'admin@example.com')
    const bad = await call(request, 'invite-user', { ...base, role: 'manager' }, admin)
    expect(bad.status()).toBe(422)
    expect(await bad.json()).toEqual({ error: 'manager_needs_restaurant' })
    const self = await call(
      request,
      'revoke-user',
      { action: 'deactivate', user_id: '22222222-2222-4222-8222-000000000006' },
      admin,
    )
    expect(await self.json()).toEqual({ error: 'not_yourself' })
  })

  test('a manager granted invite_users stays inside their own restaurant and role', async ({ request }, testInfo) => {
    const ARI = '22222222-2222-4222-8222-000000000002'
    const ADMIN = '22222222-2222-4222-8222-000000000006'
    const MAYA = '22222222-2222-4222-8222-000000000001'
    const BERT = '22222222-2222-4222-8222-000000000003'
    const RANALLIS = '11111111-1111-4111-8111-000000000004'
    const PORTER = '11111111-1111-4111-8111-000000000003'
    const SAM_INVITE = '88888888-8888-4888-8888-000000000001'

    const admin = await tokenFor(request, 'admin@example.com')
    const rights = `${SUPABASE}/rest/v1/rights`
    const asAdmin = { apikey: KEY, Authorization: `Bearer ${admin}` }
    const grant = await request.post(rights, {
      data: { user_id: ARI, key: 'invite_users', allowed: true, updated_by: ADMIN },
      headers: asAdmin,
    })
    expect(grant.status()).toBe(201)

    try {
      const ari = await tokenFor(request, 'ari.kim@example.com')
      const refusal = async (name: string, data: object) => (await (await call(request, name, data, ari)).json()).error
      const email = unique('ari.invites', testInfo)
      const send = { action: 'send', full_name: 'Ari Invites', email }

      // No other role, since every other role sees across restaurants.
      for (const role of ['ops', 'leadership', 'admin']) {
        expect(await refusal('invite-user', { ...send, role, restaurant_ids: [RANALLIS] })).toBe('admin_only')
      }
      // No restaurant but their own.
      expect(await refusal('invite-user', { ...send, role: 'manager', restaurant_ids: [PORTER] })).toBe(
        'outside_your_scope',
      )
      // Nobody and no invite outside it either.
      expect(await refusal('revoke-user', { action: 'deactivate', user_id: MAYA })).toBe('outside_your_scope')
      expect(await refusal('revoke-user', { action: 'reactivate', user_id: MAYA })).toBe('outside_your_scope')
      expect(await refusal('revoke-user', { action: 'deactivate', user_id: BERT })).toBe('admin_only')
      expect(await refusal('revoke-user', { action: 'revoke_invite', invite_id: SAM_INVITE })).toBe(
        'outside_your_scope',
      )
      expect(await refusal('invite-user', { action: 'resend', invite_id: SAM_INVITE })).toBe('outside_your_scope')

      // Inside it, the right works.
      const sent = await call(request, 'invite-user', { ...send, role: 'manager', restaurant_ids: [RANALLIS] }, ari)
      expect(sent.status()).toBe(200)
      const { id } = (await sent.json()) as { id: string }
      const revoked = await call(request, 'revoke-user', { action: 'revoke_invite', invite_id: id }, ari)
      expect(revoked.status()).toBe(200)
    } finally {
      await request.delete(`${rights}?user_id=eq.${ARI}&key=eq.invite_users`, { headers: asAdmin })
    }
  })

  test('accepting takes a real token and a strong password', async ({ request }) => {
    const junk = await call(request, 'invite-user', {
      action: 'accept',
      token: 'x'.repeat(43),
      full_name: 'Nobody',
      password: 'Kitchen4-kitchen',
    })
    expect(await junk.json()).toEqual({ error: 'link_invalid' })
    const weak = await call(request, 'invite-user', {
      action: 'accept',
      token: 'x'.repeat(43),
      full_name: 'Nobody',
      password: 'short',
    })
    expect(await weak.json()).toEqual({ error: 'weak_password' })
  })
})
