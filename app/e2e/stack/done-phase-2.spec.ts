import { expect, test, type APIRequestContext } from '@playwright/test'
import { bigPhoto, signIn, tokenFor } from './helpers'

/**
 * Phase 2's done test as one flow: a manager at Federale's Logan Square creates a
 * ticket with a photo, it is in the database with the right restaurant, and a manager
 * at Porter cannot see it, on screen or through the API. Maya closes it at the end,
 * since the Open tickets tests count her open tickets.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAYA = 'maya.reyes@example.com'
const DANA = 'dana.ortiz@example.com'

async function asPerson(request: APIRequestContext, email: string) {
  const token = await tokenFor(request, email)
  const headers = { apikey: KEY, Authorization: `Bearer ${token}` }
  return {
    headers,
    get: async (table: string, query: string) => {
      const res = await request.get(`${SUPABASE}/rest/v1/${table}?${query}`, { headers })
      expect(res.ok()).toBe(true)
      return (await res.json()) as Record<string, unknown>[]
    },
    canSign: async (path: string) => {
      const res = await request.post(`${SUPABASE}/storage/v1/object/sign/ticket-photos/${path}`, {
        data: { expiresIn: 60 },
        headers,
      })
      return res.ok()
    },
  }
}

test('a manager reports a problem with a photo, and a manager elsewhere cannot see it', async ({
  page,
  browser,
  request,
}, testInfo) => {
  const title = `Prep sink leaking ${testInfo.project.name} ${Date.now() % 100000}`
  let ticketId = ''

  try {
    // Maya, from the tab bar.
    await signIn(page, MAYA)
    await page.getByRole('link', { name: 'Create ticket', exact: true }).click()
    await page.getByRole('link', { name: /^Refrigeration/ }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Description').fill('Water under the sink by open.')
    await page.getByLabel('Choose photos').setInputFiles(await bigPhoto(page))
    await expect(page.getByRole('list', { name: 'Photos to send' }).getByRole('img')).toHaveCount(1)
    await page.getByRole('button', { name: 'Submit ticket' }).click()

    await expect(page).toHaveURL(/\/tickets$/)
    await page.getByRole('link', { name: new RegExp(title) }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Photo on this ticket' })).toBeVisible()
    await testInfo.attach('maya-ticket', { body: await page.screenshot(), contentType: 'image/png' })
    ticketId = new URL(page.url()).pathname.split('/').pop()!

    // In the database, at the right restaurant, with the photo under the ticket.
    const maya = await asPerson(request, MAYA)
    const select = 'select=title,status,restaurants(name)'
    expect(await maya.get('tickets', `id=eq.${ticketId}&${select}`)).toEqual([
      { title, status: 'open', restaurants: { name: 'Federale’s Logan Square' } },
    ])
    const photos = await maya.get('ticket_photos', `ticket_id=eq.${ticketId}&select=path`)
    expect(photos).toHaveLength(1)
    const path = photos[0]!.path as string
    expect(path.startsWith(`${ticketId}/`)).toBe(true)
    expect(await maya.canSign(path)).toBe(true)

    // Dana at Porter, on their own phone: not in the list, not by search, not by link.
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
    const phone = await context.newPage()
    await signIn(phone, DANA)
    await expect(phone.getByText('Porter', { exact: true })).toBeVisible()
    await expect(phone.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
    await expect(phone.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
    await phone.getByRole('searchbox', { name: 'Search tickets' }).fill(title)
    await expect(phone.getByRole('heading', { name: `No open tickets match "${title}"` })).toBeVisible()
    await testInfo.attach('dana-search', { body: await phone.screenshot(), contentType: 'image/png' })
    await phone.goto(`/tickets/${ticketId}`)
    await expect(phone.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
    await expect(phone.getByText(title)).toHaveCount(0)
    await context.close()

    // And the database says the same, whatever a screen shows.
    const dana = await asPerson(request, DANA)
    expect(await dana.get('tickets', `id=eq.${ticketId}&select=id`)).toEqual([])
    expect(await dana.get('ticket_photos', `ticket_id=eq.${ticketId}&select=path`)).toEqual([])
    expect(await dana.canSign(path)).toBe(false)
  } finally {
    if (ticketId) {
      const { headers } = await asPerson(request, MAYA)
      await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${ticketId}`, {
        data: { status: 'closed', resolution: 'Closed by the done test' },
        headers,
      })
    }
  }
})
