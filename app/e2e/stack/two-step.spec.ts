import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test'
import { passTwoStep, signIn, totp } from './helpers'

/**
 * 2-step verification on real accounts. Each test invites its own person, since
 * turning it on can't be undone on a seeded one without a reset, and both browsers
 * run every test. pgTAP covers what the database refuses; this covers what depends
 * on how Supabase Auth really behaves, like which sessions it will change a password in.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const PASSWORD = 'Kitchen4-kitchen'
const NEXT_PASSWORD = 'Kitchen5-kitchen'
const RESTAURANT = 'Ranalli’s Logan Square'

/** The body of the newest email to this address with this subject; waits for it to arrive. */
async function newestMail(request: APIRequestContext, to: string, subject: string) {
  let text = ''
  await expect(async () => {
    const search = await request.get(`${MAILPIT}/api/v1/search`, {
      params: { query: `to:"${to}" subject:"${subject}"` },
    })
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    expect(messages.length).toBeGreaterThan(0)
    const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)
    text = ((await message.json()) as { Text: string }).Text
  }).toPass({ timeout: 15_000 })
  return text
}

/** Admin invites someone; they set up the account on their own phone and land signed in. */
async function newPerson(
  browser: Browser,
  admin: Page,
  request: APIRequestContext,
  testInfo: TestInfo,
  name: string,
  role: 'Restaurant manager' | 'Admin / IT',
) {
  const email = `${name.toLowerCase().replace(/ /g, '.')}.${testInfo.project.name}.${Date.now() % 1_000_000}@example.com`
  await admin.goto('/admin/users/new')
  await admin.getByLabel('Full name').fill(name)
  await admin.getByLabel('Work email').fill(email)
  await admin.getByRole('radio', { name: new RegExp(role.replace('/', '\\/')) }).click()
  if (role === 'Restaurant manager') await admin.getByRole('button', { name: RESTAURANT }).click()
  await admin.getByRole('button', { name: 'Send invite' }).click()
  await expect(admin.getByRole('status').filter({ hasText: `Invite sent to ${name}.` })).toBeVisible()

  const mail = await newestMail(request, email, '')
  const link = /https?:\/\/\S+\/invite#\S+/.exec(mail)![0]
  const context = await browser.newContext({ ...testInfo.project.use, serviceWorkers: 'block' })
  const page = await context.newPage()
  await page.goto(link)
  await page.getByLabel('Create password').fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  return { email, page, close: () => context.close() }
}

async function submitSignIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-in')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function signOut(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
}

/** Sign in over the API and pay the second step, as an attacker holding the password and a code would. */
async function apiSession(request: APIRequestContext, email: string, password: string, secret: string) {
  const res = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    data: { email, password },
    headers: { apikey: KEY },
  })
  const signedIn = (await res.json()) as { access_token: string; user: { factors: { id: string }[] } }
  const factor = signedIn.user.factors[0]!.id
  const headers = { apikey: KEY, Authorization: `Bearer ${signedIn.access_token}` }
  const challenge = await request.post(`${SUPABASE}/auth/v1/factors/${factor}/challenge`, { headers })
  const { id } = (await challenge.json()) as { id: string }
  const verified = await request.post(`${SUPABASE}/auth/v1/factors/${factor}/verify`, {
    data: { challenge_id: id, code: totp(secret) },
    headers,
  })
  const session = (await verified.json()) as { access_token: string; refresh_token: string }
  return { ...session, factor }
}

const auth = (token: string) => ({ apikey: KEY, Authorization: `Bearer ${token}` })

async function ticketsSeenBy(request: APIRequestContext, token: string) {
  const rows = await request.get(`${SUPABASE}/rest/v1/tickets?select=id`, { headers: auth(token) })
  return (await rows.json()) as unknown[]
}

/** Steps 2 to 4 of setup, from Continue on step 1. Returns the secret and the backup codes. */
async function finishSetup(page: Page, testInfo: TestInfo) {
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Connect your authenticator app' })).toBeVisible()
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible()
  await testInfo.attach('mfa-scan', { body: await page.screenshot(), contentType: 'image/png' })
  const secret = (await page.getByTestId('two-step-secret').innerText()).replace(/\s/g, '')
  await page.getByRole('button', { name: "I've added it, continue" }).click()

  const turnOn = page.getByRole('button', { name: 'Verify and turn on' })
  await expect(turnOn).toBeDisabled()
  await page.getByLabel('Verification code').fill('000000')
  await turnOn.click()
  await expect(page.getByRole('alert')).toContainText("That code isn't right")
  await testInfo.attach('mfa-verify', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByLabel('Verification code').fill(totp(secret))
  await turnOn.click()

  await expect(page.getByRole('heading', { name: 'Save your backup codes' })).toBeVisible()
  const items = page.getByRole('list', { name: 'Backup codes' }).getByRole('listitem')
  await expect(items).toHaveCount(8)
  const codes = await items.allInnerTexts()
  await testInfo.attach('mfa-backup', { body: await page.screenshot(), contentType: 'image/png' })
  const done = page.getByRole('button', { name: 'Done' })
  await expect(done).toBeDisabled()
  await page.getByLabel('I saved these codes').check()
  await done.click()
  return { secret, codes }
}

test('someone turns it on, then signs in by code, by backup code and by a remembered phone', async ({
  browser,
  page,
  request,
}, testInfo) => {
  await signIn(page, 'admin@example.com')
  // Both browsers share a database, so the list must find this run's Tess.
  const tess = `Tess T${Date.now() % 1_000_000}`
  const person = await newPerson(browser, page, request, testInfo, tess, 'Restaurant manager')
  const phone = person.page
  await expect(phone).toHaveURL(/\/tickets$/)

  await phone.goto('/profile')
  await phone.getByRole('link', { name: 'Turn on' }).click()
  await expect(phone.getByRole('heading', { name: 'Turn on 2-step verification' })).toBeVisible()
  await expect(phone.getByText('Add a second step when you sign in.')).toBeVisible()
  await testInfo.attach('mfa-choose', { body: await phone.screenshot(), contentType: 'image/png' })
  const { secret, codes } = await finishSetup(phone, testInfo)
  await expect(phone.getByText('On · Authenticator app')).toBeVisible()
  await testInfo.attach('profile-on', { body: await phone.screenshot(), contentType: 'image/png' })
  await signOut(phone)

  // A password alone gets the code screen, and the API gets nothing.
  const direct = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    data: { email: person.email, password: PASSWORD },
    headers: { apikey: KEY },
  })
  const { access_token } = (await direct.json()) as { access_token: string }
  const rows = await request.get(`${SUPABASE}/rest/v1/tickets?select=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${access_token}` },
  })
  expect(await rows.json()).toEqual([])

  await submitSignIn(phone, person.email)
  await expect(phone.getByRole('heading', { name: 'Enter your code' })).toBeVisible()
  await testInfo.attach('mfa-challenge', { body: await phone.screenshot(), contentType: 'image/png' })
  await phone.getByLabel('Verification code').fill('000000')
  await phone.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(phone.getByRole('alert')).toContainText("That code isn't right")

  // A backup code works, once.
  await phone.getByRole('button', { name: 'Use a backup code instead' }).click()
  await expect(phone.getByRole('heading', { name: 'Use a backup code' })).toBeVisible()
  await phone.getByLabel('Backup code').fill(codes[0]!)
  await expect(phone.getByLabel(/Don't ask again/)).toBeHidden()
  await phone.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(phone).toHaveURL(/\/(tickets|profile)$/)
  await expect(phone.getByText(RESTAURANT).first()).toBeVisible()

  // Auth won't change the password in that session without the authenticator.
  await phone.goto('/profile')
  await phone.getByRole('button', { name: 'Change', exact: true }).click()
  await phone.getByLabel('Current password').fill(PASSWORD)
  await phone.getByLabel('New password', { exact: true }).fill(NEXT_PASSWORD)
  await phone.getByLabel('Confirm new password').fill(NEXT_PASSWORD)
  const update = phone.getByRole('button', { name: 'Update password' })
  await expect(update).toBeDisabled()
  await phone.getByLabel('Code from your authenticator app').fill(totp(secret))
  await update.click()
  await expect(phone.getByText('Password updated.')).toBeVisible()
  // The session survives it: the check on the current password didn't replace it.
  await phone.reload()
  await expect(phone.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await signOut(phone)

  await submitSignIn(phone, person.email, NEXT_PASSWORD)
  await phone.getByRole('button', { name: 'Use a backup code instead' }).click()
  await phone.getByLabel('Backup code').fill(codes[0]!)
  await phone.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(phone.getByRole('alert')).toContainText('used')

  // The authenticator, with the 30 days left on.
  await phone.getByRole('button', { name: 'Use authenticator app instead' }).click()
  await phone.getByLabel('Verification code').fill(totp(secret))
  await phone.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(phone.getByText(RESTAURANT).first()).toBeVisible()

  // Reloading keeps the session; the remembered phone skips the code next time.
  await phone.reload()
  await expect(phone.getByText(RESTAURANT).first()).toBeVisible()
  await signOut(phone)
  await submitSignIn(phone, person.email, NEXT_PASSWORD)
  await expect(phone.getByText(RESTAURANT).first()).toBeVisible()
  await expect(phone.getByRole('heading', { name: 'Enter your code' })).toBeHidden()

  // In by remembered phone: new backup codes still take the authenticator.
  await phone.goto('/profile')
  await expect(phone.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await phone.getByRole('link', { name: 'Backup codes' }).click()
  await expect(phone.getByRole('heading', { name: '7 of 8 backup codes left' })).toBeVisible()
  await phone.getByLabel('Code from your authenticator app').fill(totp(secret))
  await phone.getByRole('button', { name: 'Get new codes' }).click()
  const items = phone.getByRole('list', { name: 'Backup codes' }).getByRole('listitem')
  await expect(items).toHaveCount(8)
  const fresh = await items.allInnerTexts()
  expect(fresh).not.toContain(codes[1])
  await phone.getByLabel('I saved these codes').check()
  await phone.getByRole('button', { name: 'Done' }).click()
  await expect(phone.getByRole('heading', { name: 'Profile' })).toBeVisible()

  // Someone else is signed in as Tess, having got past the second step once.
  const attacker = await apiSession(request, person.email, NEXT_PASSWORD, secret)
  expect(await ticketsSeenBy(request, attacker.access_token)).not.toEqual([])

  // An admin resets it: the row says so, an email goes out, and it's asked for again.
  await page.goto('/admin/users')
  await page
    .getByRole('link', { name: new RegExp(tess) })
    .first()
    .click()
  await expect(page.getByText('8 of 8 backup codes left')).toBeVisible()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  const confirm = page.getByRole('button', { name: 'Reset 2-step verification' })
  await expect(confirm).toBeDisabled()
  await page.waitForTimeout(400) // let the sheet finish sliding up
  await testInfo.attach('admin-reset-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByLabel(/I confirmed it's Tess/).check()
  await confirm.click()
  await expect(page.getByRole('status').filter({ hasText: 'An email went to Tess' })).toBeVisible()
  await expect(page.getByText('Not set up · required at next sign-in')).toBeVisible()
  await testInfo.attach('admin-reset-done', { body: await page.screenshot(), contentType: 'image/png' })
  expect(await newestMail(request, person.email, 'Your 2-step verification was reset')).toContain('admin reset')

  // The reset ends that session: its token reads nothing and mints nothing, and it can't refresh.
  expect(await ticketsSeenBy(request, attacker.access_token)).toEqual([])
  const minted = await request.post(`${SUPABASE}/rest/v1/rpc/new_backup_codes`, {
    headers: auth(attacker.access_token),
  })
  expect(minted.ok()).toBe(false)
  const refreshed = await request.post(`${SUPABASE}/auth/v1/token?grant_type=refresh_token`, {
    data: { refresh_token: attacker.refresh_token },
    headers: { apikey: KEY },
  })
  expect(refreshed.ok()).toBe(false)

  // Tokens count whole seconds, so one from the same second as the reset counts as before it.
  await phone.waitForTimeout(1100)

  await signOut(phone)
  await submitSignIn(phone, person.email, NEXT_PASSWORD)
  await expect(phone.getByRole('heading', { name: 'Turn on 2-step verification' })).toBeVisible()
  await finishSetup(phone, testInfo)
  await expect(phone).toHaveURL(/\/(tickets|profile)$/)
  await person.close()
})

test('a new admin must set it up before anything works', async ({ browser, page, request }, testInfo) => {
  await signIn(page, 'admin@example.com')
  const person = await newPerson(browser, page, request, testInfo, 'Ada Admin', 'Admin / IT')
  const phone = person.page

  await expect(phone.getByRole('heading', { name: 'Turn on 2-step verification' })).toBeVisible()
  await expect(phone.getByText(/requires a second step when you sign in/)).toBeVisible()
  await testInfo.attach('mfa-choose-required', { body: await phone.screenshot(), contentType: 'image/png' })

  // Not by going straight to an admin screen, and not through the API.
  await phone.goto('/admin/users')
  await expect(phone.getByRole('heading', { name: 'Turn on 2-step verification' })).toBeVisible()
  const direct = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    data: { email: person.email, password: PASSWORD },
    headers: { apikey: KEY },
  })
  const { access_token } = (await direct.json()) as { access_token: string }
  const users = await request.get(`${SUPABASE}/rest/v1/profiles?select=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${access_token}` },
  })
  expect(await users.json()).toEqual([])
  const invite = await request.post(`${SUPABASE}/functions/v1/invite-user`, {
    data: { action: 'send', email: 'nobody@example.com', full_name: 'Nobody', role: 'admin', restaurant_ids: [] },
    headers: { apikey: KEY, Authorization: `Bearer ${access_token}` },
  })
  expect(invite.status()).toBe(403)

  await finishSetup(phone, testInfo)
  await expect(phone.getByRole('heading', { name: 'Users' })).toBeVisible()
  await expect(phone.getByRole('link', { name: /Maya Reyes/ }).first()).toBeVisible()
  await person.close()
})

test('removing your own authenticator through the API does not turn 2-step off', async ({
  browser,
  page,
  request,
}, testInfo) => {
  await signIn(page, 'admin@example.com')
  const person = await newPerson(browser, page, request, testInfo, 'Una Manager', 'Restaurant manager')
  const phone = person.page
  await expect(phone).toHaveURL(/\/tickets$/)
  await phone.goto('/profile/2-step')
  const { secret } = await finishSetup(phone, testInfo)
  await expect(phone.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await signOut(phone)

  const session = await apiSession(request, person.email, PASSWORD, secret)
  const removed = await request.delete(`${SUPABASE}/auth/v1/factors/${session.factor}`, {
    headers: auth(session.access_token),
  })
  expect(removed.ok()).toBe(true)

  // Auth let it go, but a password alone still gets nothing, and the app asks for setup.
  const direct = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    data: { email: person.email, password: PASSWORD },
    headers: { apikey: KEY },
  })
  const { access_token } = (await direct.json()) as { access_token: string }
  expect(await ticketsSeenBy(request, access_token)).toEqual([])
  await submitSignIn(phone, person.email)
  await expect(phone.getByRole('heading', { name: 'Turn on 2-step verification' })).toBeVisible()
  await finishSetup(phone, testInfo)
  await expect(phone.getByText(RESTAURANT).first()).toBeVisible()
  await person.close()
})

test('a reset link with 2-step on asks for a code before the new password', async ({
  browser,
  page,
  request,
}, testInfo) => {
  await signIn(page, 'admin@example.com')
  const person = await newPerson(browser, page, request, testInfo, 'Rae Manager', 'Restaurant manager')
  const phone = person.page
  await expect(phone).toHaveURL(/\/tickets$/)
  await phone.goto('/profile/2-step')
  const { secret } = await finishSetup(phone, testInfo)
  await expect(phone.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await signOut(phone)

  // This browser is remembered, which must not help someone holding only the inbox.
  await submitSignIn(phone, person.email)
  await phone.getByLabel('Verification code').fill(totp(secret))
  await phone.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(phone.getByText(RESTAURANT).first()).toBeVisible()
  await signOut(phone)

  await phone.goto('/reset')
  await phone.getByLabel('Work email').fill(person.email)
  await phone.getByRole('button', { name: /reset link/i }).click()
  await expect(phone.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  const mail = await newestMail(request, person.email, 'password')
  await phone.goto(/https?:\/\/\S+\/reset\/new#[^\s)\]]+/.exec(mail)![0].replace(/&amp;/g, '&'))

  await expect(phone.getByRole('heading', { name: 'Enter your code' })).toBeVisible()
  await expect(phone.getByRole('button', { name: 'Use a backup code instead' })).toBeHidden()
  const recovery = await phone.evaluate(
    () => (JSON.parse(localStorage.getItem('ontrack.auth')!) as { access_token: string }).access_token,
  )
  expect(await ticketsSeenBy(request, recovery)).toEqual([])
  await passTwoStepForReset(phone, secret)
  await expect(phone.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await phone.getByLabel('New password', { exact: true }).fill('Kitchen6-kitchen')
  await phone.getByLabel('Confirm new password').fill('Kitchen6-kitchen')
  await phone.getByRole('button', { name: 'Save new password' }).click()
  await expect(phone).toHaveURL(/\/reset\/done$/)

  await submitSignIn(phone, person.email, 'Kitchen6-kitchen')
  await passTwoStep(phone, secret)
  await expect(phone).toHaveURL(/\/tickets$/)
  await person.close()
})

async function passTwoStepForReset(page: Page, secret: string) {
  await page.getByLabel('Verification code').fill(totp(secret))
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
}
