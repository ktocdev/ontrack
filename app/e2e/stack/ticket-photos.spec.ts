import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { bigPhoto, signIn, tokenFor } from './helpers'

/**
 * Ticket photos against the seed, with real files in the local stack's storage.
 * Everything is made as Ari at Ranalli's, as the other flows do, since tickets stay.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const T1045 = '66666666-6666-4666-8666-000000001045'

const pick = async (page: Page, name?: string) =>
  page.getByLabel('Choose photos').setInputFiles(await bigPhoto(page, name))

/** A path the database holds for this ticket, as the person named sees it. */
async function photoPaths(request: APIRequestContext, email: string, ticketId: string) {
  const token = await tokenFor(request, email)
  const res = await request.get(`${SUPABASE}/rest/v1/ticket_photos?ticket_id=eq.${ticketId}&select=path`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  })
  return ((await res.json()) as { path: string }[]).map((p) => p.path)
}

test('a ticket is created with a photo, shrunk to 1600px, and another manager cannot open it', async ({
  page,
  request,
}, testInfo) => {
  const title = `Cracked gasket ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/tickets/new')
  await page.getByRole('link', { name: /^Refrigeration/ }).click()
  await page.getByLabel('Title').fill(title)

  await pick(page)
  const tray = page.getByRole('list', { name: 'Photos to send' })
  await expect(tray.getByRole('img')).toHaveCount(1)
  await pick(page, 'second.png')
  await expect(tray.getByRole('img')).toHaveCount(2)
  await page.getByRole('button', { name: 'Remove photo 2' }).click()
  await expect(tray.getByRole('img')).toHaveCount(1)
  await testInfo.attach('form-photo', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await expect(page).toHaveURL(/\/tickets$/)
  await page.getByRole('link', { name: new RegExp(title) }).click()

  const photo = page.getByRole('img', { name: 'Photo on this ticket' })
  await expect(photo).toBeVisible()
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600)
  await testInfo.attach('ticket-photo', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Open: Photo on this ticket' }).click()
  await expect(page.getByRole('dialog', { name: 'Photo' }).getByRole('img')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()

  const ticketId = new URL(page.url()).pathname.split('/').pop()!
  const [path] = await photoPaths(request, 'ari.kim@example.com', ticketId)
  expect(path).toMatch(new RegExp(`^${ticketId}/.+\\.jpg$`))

  expect(await photoPaths(request, 'maya.reyes@example.com', ticketId)).toEqual([])
  const maya = await tokenFor(request, 'maya.reyes@example.com')
  const signed = await request.post(`${SUPABASE}/storage/v1/object/sign/ticket-photos/${path}`, {
    data: { expiresIn: 60 },
    headers: { apikey: KEY, Authorization: `Bearer ${maya}` },
  })
  expect(signed.ok()).toBe(false)
})

test('an update can carry a photo, or only a photo', async ({ page }, testInfo) => {
  const text = `Rattle video still ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.goto(`/tickets/${T1045}`)
  const send = page.getByRole('button', { name: 'Post update' })
  const log = page.getByRole('log', { name: 'Ticket updates' })

  await pick(page)
  await expect(page.getByRole('list', { name: 'Photos to send' }).getByRole('img')).toHaveCount(1)
  await expect(send).toBeEnabled()
  await page.getByRole('textbox', { name: 'Write an update for Ops' }).fill(text)
  await send.click()
  await expect(log.getByText(text)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Photos to send' })).toHaveCount(0)
  const before = await log.getByRole('img', { name: 'Photo from You' }).count()
  expect(before).toBeGreaterThan(0)

  await pick(page, 'alone.png')
  await expect(page.getByRole('list', { name: 'Photos to send' }).getByRole('img')).toHaveCount(1)
  await send.click()
  await expect(log.getByRole('img', { name: 'Photo from You' })).toHaveCount(before + 1)
  await expect(page.getByRole('list', { name: 'Photos to send' })).toHaveCount(0)
  await testInfo.attach('thread-photo', { body: await page.screenshot(), contentType: 'image/png' })
})

test('a failed upload posts nothing and keeps the photo and the words', async ({ page }, testInfo) => {
  const text = `Should not post ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.goto(`/tickets/${T1045}`)
  await pick(page)
  await expect(page.getByRole('list', { name: 'Photos to send' }).getByRole('img')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Write an update for Ops' }).fill(text)

  await page.route('**/storage/v1/object/ticket-photos/**', (route) =>
    route.fulfill({ status: 500, json: { message: 'nope' } }),
  )
  await page.getByRole('button', { name: 'Post update' }).click()
  await expect(page.getByRole('alert')).toContainText("Couldn't post that yet.")
  await expect(page.getByRole('list', { name: 'Photos to send' }).getByRole('img')).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: 'Write an update for Ops' })).toHaveValue(text)
  await expect(page.getByRole('log', { name: 'Ticket updates' }).getByText(text)).toHaveCount(0)
})

test('a file that is not a picture says so', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  await page.goto(`/tickets/${T1045}`)
  await page
    .getByLabel('Choose photos')
    .setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert')).toContainText("That photo couldn't be read.")
})

test('a seeded photo with no file shows the board’s placeholder, not a broken image', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/tickets/66666666-6666-4666-8666-000000001042')
  await expect(page.getByRole('log').getByRole('img', { name: 'Photo from You' })).toBeVisible()
  await expect(page.getByRole('log').locator('img')).toHaveCount(0)
})
