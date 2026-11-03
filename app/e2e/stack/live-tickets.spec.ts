import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Lists keep up on their own (OT-58). The screens also reread every 30 seconds, so each wait
 * here is well under that, and nothing is clicked or reloaded. Realtime has to be running.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const PORTER = '11111111-1111-4111-8111-000000000003'
const CATEGORY = '33333333-3333-4333-8333-000000000012'
const QUICK = { timeout: 10_000 }

async function danaCreates(request: APIRequestContext, title: string) {
  const token = (await tokenFor(request, 'dana.ortiz@example.com'))!
  const sub = (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { sub: string }).sub
  const res = await request.post(`${SUPABASE}/rest/v1/tickets?select=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, Prefer: 'return=representation' },
    data: { restaurant_id: PORTER, category_id: CATEGORY, title, created_by: sub },
  })
  expect(res.ok()).toBe(true)
  return ((await res.json()) as { id: string }[])[0]!.id
}

test('a new ticket appears on the Ops dashboard by itself', async ({ page, request }, testInfo) => {
  const title = `Live new ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'bert.velilla@example.com')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.waitForTimeout(2_000) // Long enough to be subscribed.
  await danaCreates(request, title)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible(QUICK)
})

test('a status change reaches a manager’s Open tickets by itself', async ({ page, request }, testInfo) => {
  const title = `Live status ${testInfo.project.name} ${Date.now() % 100000}`
  const id = await danaCreates(request, title)
  await signIn(page, 'dana.ortiz@example.com')
  const card = page.getByRole('link', { name: new RegExp(title) })
  await expect(card).toContainText('Not picked up yet')
  await page.waitForTimeout(2_000)

  const started = await request.post(`${SUPABASE}/rest/v1/rpc/set_ticket_status`, {
    headers: { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, 'bert.velilla@example.com')}` },
    data: { p_id: id, p_status: 'in_progress' },
  })
  expect(started.ok()).toBe(true)
  await expect(card).toContainText('In progress', QUICK)
})

test('an update reaches an open ticket by itself', async ({ page, request }, testInfo) => {
  const title = `Live thread ${testInfo.project.name} ${Date.now() % 100000}`
  const id = await danaCreates(request, title)
  await signIn(page, 'dana.ortiz@example.com')
  await page.goto(`/tickets/${id}`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.waitForTimeout(2_000)

  const posted = await request.post(`${SUPABASE}/rest/v1/rpc/post_ticket_update`, {
    headers: { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, 'bert.velilla@example.com')}` },
    data: { p_ticket_id: id, p_body: 'On my way over' },
  })
  expect(posted.ok()).toBe(true)
  await expect(page.getByRole('log', { name: 'Ticket updates' }).getByText('On my way over')).toBeVisible(QUICK)
})

test('another restaurant’s manager gets nothing new', async ({ page, request }, testInfo) => {
  const title = `Live other ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await expect(page.getByRole('heading', { name: 'Open tickets' })).toBeVisible()
  await page.waitForTimeout(2_000)
  await danaCreates(request, title)
  await page.waitForTimeout(3_000)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
})
