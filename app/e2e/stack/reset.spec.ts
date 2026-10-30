import { expect, test, type APIRequestContext } from '@playwright/test'
import { openProfile, SEED_PASSWORD, signIn } from './helpers'

/**
 * Password reset, through the real reset email in the local stack's Mailpit
 * inbox. Lee Chen's password changes here and is put back after, so the other
 * suites still sign in with the seed's.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const EMAIL = 'lee.chen@example.com'
const NEW_PASSWORD = 'Kitchen4-kitchen'

async function messagesTo(request: APIRequestContext, to: string, subject: string) {
  const res = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}" subject:"${subject}"` } })
  return ((await res.json()) as { messages: { ID: string }[] }).messages
}

/** The newest email with this subject that isn't one of those seen before. */
async function newMessage(request: APIRequestContext, to: string, subject: string, seen: string[]) {
  let id = ''
  await expect(async () => {
    const fresh = (await messagesTo(request, to, subject)).filter((m) => !seen.includes(m.ID))
    expect(fresh.length).toBeGreaterThan(0)
    id = fresh[0]!.ID
  }).toPass({ timeout: 15_000 })
  const res = await request.get(`${MAILPIT}/api/v1/message/${id}`)
  return (await res.json()) as { HTML: string; Text: string }
}

const seenIds = async (request: APIRequestContext, to: string, subject: string) =>
  (await messagesTo(request, to, subject)).map((m) => m.ID)

const RESET = 'Reset your OnTrack password'

/** The link in the email's button, undoing the HTML escaping of its query. */
const linkIn = (html: string) => /href="([^"]+\/reset\/new#[^"]+)"/.exec(html)![1]!.replace(/&amp;/g, '&')

async function putSeedPasswordBack(request: APIRequestContext) {
  const signedIn = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    data: { email: EMAIL, password: NEW_PASSWORD },
    headers: { apikey: KEY },
  })
  const { access_token } = (await signedIn.json()) as { access_token: string }
  const put = await request.put(`${SUPABASE}/auth/v1/user`, {
    data: { password: SEED_PASSWORD },
    headers: { apikey: KEY, Authorization: `Bearer ${access_token}` },
  })
  expect(put.status()).toBe(200)
}

test('a reset from the email: new password works, the old one and the link do not', async ({
  page,
  request,
}, testInfo) => {
  const seen = await seenIds(request, EMAIL, RESET)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/sign-in')
  await page.getByLabel('Work email').fill(EMAIL)
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await expect(page.getByLabel('Work email')).toHaveValue(EMAIL)
  await testInfo.attach('reset-request', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('button', { name: 'Send reset link' }).click()

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(page.getByText(EMAIL)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Resend link in 0:/ })).toBeDisabled()
  await testInfo.attach('reset-sent', { body: await page.screenshot(), contentType: 'image/png' })

  const mail = await newMessage(request, EMAIL, RESET, seen)
  const link = linkIn(mail.HTML)
  await page.goto(link)
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await expect(page.getByText(`For ${EMAIL}`)).toBeVisible()

  const save = page.getByRole('button', { name: 'Save new password' })
  await expect(save).toBeDisabled()
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Confirm new password').fill('not the same')
  await expect(page.getByText("Passwords don't match yet")).toBeVisible()
  await testInfo.attach('reset-new', { body: await page.screenshot(), contentType: 'image/png' })
  await expect(save).toBeDisabled()

  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD)
  await expect(page.getByText('Passwords match')).toBeVisible()
  const notices = await seenIds(request, EMAIL, 'Your OnTrack password changed')
  await save.click()

  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()
  await expect(page.getByText("You're signed out on your other phones and computers.")).toBeVisible()
  await testInfo.attach('reset-done', { body: await page.screenshot(), contentType: 'image/png' })
  await newMessage(request, EMAIL, 'Your OnTrack password changed', notices)

  try {
    // Done leads to a plain Sign in, with no signed-out sheet in the way.
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.getByLabel('Work email').fill(EMAIL)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText("That email and password don't match.")).toBeVisible()

    await page.getByLabel('Password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible()

    // The link was good once.
    await page.goto(link)
    await expect(page.getByRole('heading', { name: 'This reset link has expired' })).toBeVisible()
  } finally {
    await putSeedPasswordBack(request)
  }
})

test('the same password as before is refused', async ({ page, request }) => {
  const seen = await seenIds(request, EMAIL, RESET)
  await page.goto('/reset')
  await page.getByLabel('Work email').fill(EMAIL)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  const mail = await newMessage(request, EMAIL, RESET, seen)
  await page.goto(linkIn(mail.HTML))
  // Meets the rules only if the seed's password did, so use a stronger current one first.
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()

  const again = await seenIds(request, EMAIL, RESET)
  await page.goto('/reset')
  await page.getByLabel('Work email').fill(EMAIL)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  const second = await newMessage(request, EMAIL, RESET, again)
  try {
    await page.goto(linkIn(second.HTML))
    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByLabel('Confirm new password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByText('Use a different password from your last one.')).toBeVisible()
  } finally {
    await putSeedPasswordBack(request)
  }
})

test('an address with no account looks the same and gets nothing', async ({ page, request }) => {
  const email = `nobody.${Date.now()}@example.com`
  await page.goto('/reset')
  await page.getByLabel('Work email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
  await page.waitForTimeout(1500)
  expect(await messagesTo(request, email, RESET)).toHaveLength(0)
})

test('a bad link offers a new one, and sends it to the address in the link', async ({ page, request }, testInfo) => {
  const seen = await seenIds(request, 'ari.kim@example.com', RESET)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/reset/new#token_hash=not-a-real-token&email=ari.kim@example.com')
  await expect(page.getByRole('heading', { name: 'This reset link has expired' })).toBeVisible()
  await testInfo.attach('reset-expired', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('button', { name: 'Email me a new link' }).click()
  await expect(page.getByRole('button', { name: 'New link sent' })).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'Check ari.kim@example.com.' })).toBeVisible()
  await newMessage(request, 'ari.kim@example.com', RESET, seen)
})

test('a link from the stock Supabase email signs nobody in and says what is wrong', async ({ page }) => {
  await page.goto('/reset/new#access_token=abc&refresh_token=def&expires_in=3600&type=recovery')
  await expect(page.getByRole('heading', { name: "This reset link isn't set up right" })).toBeVisible()
  await expect(page).toHaveURL(/\/reset\/new$/)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
})

test('nobody reaches the form without a link, even signed in', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/reset/new')
  await expect(page.getByRole('heading', { name: 'This reset link has expired' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save new password' })).toBeHidden()
  // With no address in the link, the button asks for one.
  await page.getByRole('button', { name: 'Email me a new link' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
})

test('Profile and Help link to it with the email filled in', async ({ page }) => {
  await openProfile(page, 'maya.reyes@example.com')
  await page.getByRole('button', { name: 'Change', exact: true }).click()
  await page.getByRole('link', { name: 'Forgot your current password?' }).click()
  await expect(page.getByLabel('Work email')).toHaveValue('maya.reyes@example.com')

  await page.goto('/profile/help')
  await page.getByRole('link', { name: /Can't sign in\?/ }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await expect(page.getByLabel('Work email')).toHaveValue('maya.reyes@example.com')
})

test('going straight to the later steps goes back to the start', async ({ page }) => {
  await page.goto('/reset/sent')
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await page.goto('/reset/done')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
