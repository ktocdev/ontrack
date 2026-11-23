import { createHmac } from 'node:crypto'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

/** Every seeded person signs in with this (supabase/seed.sql). */
export const SEED_PASSWORD = 'ontrack-demo-2026'

/** The seeded admin's authenticator secret (supabase/seed.sql). */
const ADMIN_SECRET = 'JBSWY3DPEHPK3PXP'

/**
 * The seeded people who hold Admin and so sign in with a code (supabase/seed.sql): admin@,
 * and Rosa, the head ops manager, on the Support Team (OT-122).
 */
const SECOND_STEP: Record<string, { secret: string; factor: string }> = {
  'admin@example.com': { secret: ADMIN_SECRET, factor: '33333333-3333-4333-8333-000000000006' },
  'rosa.delgado@example.com': { secret: 'KRUGKZLBMRWWS3TT', factor: '33333333-3333-4333-8333-000000000009' },
}

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

/** What an authenticator app would show right now for this base32 secret (RFC 6238). */
export function totp(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = [...secret.replace(/\s/g, '')].map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const mac = createHmac('sha1', key).update(counter).digest()
  const offset = mac[mac.length - 1]! & 0xf
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/** An API token, as an app would hold after signing in; a seeded admin's has done its second step. */
export async function tokenFor(request: APIRequestContext, email: string, password = SEED_PASSWORD) {
  const res = await request.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    data: { email, password },
    headers: { apikey: KEY },
  })
  const token = ((await res.json()) as { access_token?: string }).access_token
  const step = SECOND_STEP[email]
  if (!token || !step) return token
  const headers = { apikey: KEY, Authorization: `Bearer ${token}` }
  const challenge = await request.post(`${SUPABASE}/auth/v1/factors/${step.factor}/challenge`, { headers })
  const { id } = (await challenge.json()) as { id: string }
  const verified = await request.post(`${SUPABASE}/auth/v1/factors/${step.factor}/verify`, {
    data: { challenge_id: id, code: totp(step.secret) },
    headers,
  })
  return ((await verified.json()) as { access_token: string }).access_token
}

/** Answer the 2-step screen without remembering the phone, so each test signs in the same way. */
export async function passTwoStep(page: Page, secret = ADMIN_SECRET) {
  await page.getByLabel('Verification code').fill(totp(secret))
  await page.getByLabel(/Don't ask again/).uncheck()
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
}

/** A real PNG drawn in the browser, far larger than the app should ever upload. */
export async function bigPhoto(page: Page, name = 'big.png') {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2400
    canvas.height = 1800
    const c = canvas.getContext('2d')!
    c.fillStyle = '#336699'
    c.fillRect(0, 0, 2400, 1800)
    return canvas.toDataURL('image/png')
  })
  return { name, mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64') }
}

/**
 * Opens every restaurant row on the Ops dashboard (OT-168), which start closed each day
 * showing only urgent tickets, for a flow that needs the rest. Kept on this page for the day.
 */
export async function openRestaurants(page: Page) {
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
  // Each click takes a row out of this list, so it is always the first that is still closed.
  const closed = page.locator('section > h2 > button[aria-expanded="false"]')
  for (let n = await closed.count(); n > 0; n--) await closed.first().click()
  await expect(closed).toHaveCount(0)
}

/** Sign in through the real form and wait for the role's home screen. */
export async function signIn(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto('/sign-in')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  const step = SECOND_STEP[email]
  if (step) await passTwoStep(page, step.secret)
  await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible()
}

export async function openProfile(page: Page, email: string) {
  await signIn(page, email)
  await page.getByRole('link', { name: 'Your profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
}
