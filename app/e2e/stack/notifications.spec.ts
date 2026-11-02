import { createECDH, randomBytes } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Profile · Notifications. Playwright blocks service workers, so the browser's side is
 * stubbed with a real key pair, and test-push really encrypts and posts. The stack's push
 * sink answers 404, as a push service does for a device it doesn't know. The buzz itself
 * is tried by hand on a real phone.
 */

const BERT = 'bert.velilla@example.com'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

function fakeDevice() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/test-${randomBytes(6).toString('hex')}`,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  }
}

/** The browser's push parts: permission as given, and a subscription held in the page. */
async function stubBrowser(page: Page, device: ReturnType<typeof fakeDevice>, permission = 'granted') {
  await page.addInitScript(
    ({ device, permission }) => {
      let held: unknown = null
      const stored = () => localStorage.getItem('test.pushHeld') === '1'
      const subscription = {
        endpoint: device.endpoint,
        toJSON: () => ({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }),
        unsubscribe: () => {
          held = null
          localStorage.removeItem('test.pushHeld')
          return Promise.resolve(true)
        },
      }
      const pushManager = {
        getSubscription: () => Promise.resolve(held ?? (stored() ? subscription : null)),
        subscribe: () => {
          held = subscription
          localStorage.setItem('test.pushHeld', '1')
          return Promise.resolve(subscription)
        },
      }
      const registration = { pushManager }
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { ready: Promise.resolve(registration), getRegistration: () => Promise.resolve(registration) },
      })
      Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} })
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: { permission, requestPermission: () => Promise.resolve(permission) },
      })
    },
    { device, permission },
  )
}

async function rows(request: APIRequestContext, email: string, endpoint: string) {
  const token = await tokenFor(request, email)
  const res = await request.get(
    `${SUPABASE}/rest/v1/push_subscriptions?select=endpoint&endpoint=eq.${encodeURIComponent(endpoint)}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${token}` } },
  )
  return ((await res.json()) as unknown[]).length
}

async function openProfile(page: Page, email: string) {
  await signIn(page, email)
  await page.getByRole('link', { name: 'Your profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
}

const deviceSwitch = (page: Page) => page.getByRole('switch', { name: 'Notifications on this device' })

test('turning on saves this device, and a test that can’t reach it says so and removes it', async ({
  page,
  request,
}, testInfo) => {
  const device = fakeDevice()
  await stubBrowser(page, device)
  await openProfile(page, BERT)
  await expect(deviceSwitch(page)).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Send' })).toHaveCount(0)

  await deviceSwitch(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Notifications are on for this device.' })).toBeVisible()
  await expect(deviceSwitch(page)).toBeChecked()
  expect(await rows(request, BERT, device.endpoint)).toBe(1)
  await deviceSwitch(page).scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await testInfo.attach('on', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Couldn’t reach this device.' })).toBeVisible()
  expect(await rows(request, BERT, device.endpoint)).toBe(0)
})

test('turning off and signing out each remove this device', async ({ page, request }) => {
  const device = fakeDevice()
  await stubBrowser(page, device)
  await openProfile(page, BERT)
  await deviceSwitch(page).click()
  await expect(deviceSwitch(page)).toBeChecked()
  await deviceSwitch(page).click()
  await expect(deviceSwitch(page)).not.toBeChecked()
  expect(await rows(request, BERT, device.endpoint)).toBe(0)

  await deviceSwitch(page).click()
  await expect(deviceSwitch(page)).toBeChecked()
  expect(await rows(request, BERT, device.endpoint)).toBe(1)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  expect(await rows(request, BERT, device.endpoint)).toBe(0)
})

test('opening the app puts back a device whose row was removed', async ({ page, request }) => {
  const device = fakeDevice()
  await stubBrowser(page, device)
  await openProfile(page, BERT)
  await deviceSwitch(page).click()
  await expect(deviceSwitch(page)).toBeChecked()

  const token = await tokenFor(request, BERT)
  await request.delete(`${SUPABASE}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(device.endpoint)}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
  expect(await rows(request, BERT, device.endpoint)).toBe(0)
  await page.goto('/ops')
  await expect.poll(() => rows(request, BERT, device.endpoint)).toBe(1)
  await page.goto('/profile')
  await deviceSwitch(page).click()
  await expect(deviceSwitch(page)).not.toBeChecked()
})

test('refusing permission leaves it off and says why', async ({ page }) => {
  await stubBrowser(page, fakeDevice(), 'default')
  await page.addInitScript(() => {
    ;(Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = () =>
      Promise.resolve('denied')
  })
  await openProfile(page, BERT)
  await deviceSwitch(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Notifications weren’t allowed' })).toBeVisible()
  await expect(deviceSwitch(page)).not.toBeChecked()
})

test('blocked notifications explain themselves, with no switch', async ({ page }) => {
  await stubBrowser(page, fakeDevice(), 'denied')
  await openProfile(page, BERT)
  await expect(page.getByText('Notifications are blocked.')).toBeVisible()
  await expect(deviceSwitch(page)).toHaveCount(0)
})

test('an iPhone in Safari is told to add the app first', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'PushManager')
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })
  })
  await openProfile(page, BERT)
  await expect(page.getByText('add OnTrack to your Home Screen first')).toBeVisible()
})

test('each role sees the kinds it is sent, and a switch stays as set', async ({ page, browser }, testInfo) => {
  await openProfile(page, 'chris.novak@example.com')
  for (const name of ['New tickets', 'Reopened tickets', 'Status changes', 'Updates']) {
    await expect(page.getByRole('switch', { name })).toBeChecked()
  }
  await page.getByRole('switch', { name: 'New tickets' }).click()
  await expect(page.getByRole('switch', { name: 'New tickets' })).not.toBeChecked()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'New tickets' })).not.toBeChecked()
  await expect(page.getByRole('switch', { name: 'Updates' })).toBeChecked()
  await page.getByRole('switch', { name: 'New tickets' }).click()
  await expect(page.getByRole('switch', { name: 'New tickets' })).toBeChecked()

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const manager = await context.newPage()
  await openProfile(manager, 'dana.ortiz@example.com')
  await expect(manager.getByRole('switch', { name: 'Status changes' })).toBeChecked()
  await expect(manager.getByRole('switch', { name: 'Updates' })).toBeChecked()
  await expect(manager.getByRole('switch', { name: 'New tickets' })).toHaveCount(0)
  await manager.getByRole('switch', { name: 'Updates' }).scrollIntoViewIfNeeded()
  await manager.waitForTimeout(300)
  await testInfo.attach('manager', { body: await manager.screenshot(), contentType: 'image/png' })
  await context.close()
})

test('the test function refuses the signed-out and another person’s device', async ({ page, request }) => {
  const device = fakeDevice()
  await stubBrowser(page, device)
  await openProfile(page, BERT)
  await deviceSwitch(page).click()
  await expect(deviceSwitch(page)).toBeChecked()

  const url = `${SUPABASE}/functions/v1/test-push`
  const signedOut = await request.post(url, { headers: { apikey: KEY }, data: { endpoint: device.endpoint } })
  expect(signedOut.status()).toBe(401)
  const token = await tokenFor(request, 'chris.novak@example.com')
  const other = await request.post(url, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    data: { endpoint: device.endpoint },
  })
  expect(other.status()).toBe(404)
  expect(await rows(request, BERT, device.endpoint)).toBe(1)

  await deviceSwitch(page).click()
  await expect(deviceSwitch(page)).not.toBeChecked()
})
