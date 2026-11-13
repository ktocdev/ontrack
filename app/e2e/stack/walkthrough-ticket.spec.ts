import { expect, test, type APIRequestContext } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Walkthrough · Quick ticket and the walkthrough's Edit ticket, against the seed: Ari works
 * Ranalli's October walkthrough, Front of House › Aesthetics › Paint, an item with no
 * category, so the sheet asks for one. Tickets are never deleted, so the test closes the
 * ones it made, which leaves Good free on the item for the next run.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const ARI = 'ari.kim@example.com'
const RANALLIS_OCT = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'
const FOH = 'cccccccc-cccc-4ccc-8ccc-000000000002'

async function closeOpenTickets(request: APIRequestContext) {
  const h = { apikey: KEY, Authorization: `Bearer ${await tokenFor(request, ARI)}` }
  const res = await request.get(
    `${SUPABASE}/rest/v1/tickets?select=id&walkthrough_id=eq.${RANALLIS_OCT}&title=like.Peeling*&status=neq.closed`,
    { headers: h },
  )
  for (const { id } of (await res.json()) as { id: string }[]) {
    await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${id}`, { headers: h, data: { status: 'closed' } })
  }
}

test.beforeEach(async ({ request }) => closeOpenTickets(request))
test.afterEach(async ({ request }) => closeOpenTickets(request))

test('a ticket from an item asks for a category, carries the tag, and edits back to the checklist', async ({
  page,
}, testInfo) => {
  const title = `Peeling paint by the host stand ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, ARI)
  await page.goto(`/walkthrough/${RANALLIS_OCT}/${FOH}`)
  await page.getByRole('button', { name: /^Aesthetics/ }).click()
  const paint = page.getByRole('group', { name: 'Paint', exact: true })
  // An earlier run's ticket, closed, may already be on the item.
  await paint.getByRole('button', { name: /^(Create ticket|Add another ticket) for Paint/ }).click()

  const sheet = page.getByRole('dialog', { name: 'Create ticket' })
  await expect(sheet.getByText('Front of House', { exact: true })).toBeVisible()
  await expect(sheet.getByText('Aesthetics', { exact: true })).toBeVisible()
  const create = sheet.getByRole('button', { name: 'Create ticket' })
  await sheet.getByLabel("What's wrong?").fill(title)
  // Paint names no category, so the ticket waits for one.
  await expect(create).toBeDisabled()
  await sheet.getByLabel('Category').selectOption({ label: 'Decorations' })
  await sheet.getByRole('radio', { name: 'Urgent' }).click()
  await testInfo.attach('quick ticket', { body: await page.screenshot(), contentType: 'image/png' })
  await create.click()
  await page.getByRole('button', { name: 'Proceed without photo' }).click()
  await expect(page.getByText(/^OT-\d+ created\. Ops has been notified\.$/)).toBeVisible()

  // The ticket shows under the item, Good steps aside, and Ticket offers another.
  const entry = page.getByRole('link', { name: new RegExp(title) })
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('URGENT')
  await expect(paint.getByRole('button', { name: 'Good' })).toHaveCount(0)
  // The group's header says a ticket is still open in it, folded or not.
  await expect(page.getByRole('button', { name: /^Aesthetics/ })).toContainText('1 ticket')
  await paint.getByRole('button', { name: /^Add another ticket for Paint/ }).click()
  const again = page.getByRole('dialog', { name: 'Add another ticket' })
  await expect(again.getByText(/Already on this item: OT-\d+/)).toBeVisible()
  await again.getByRole('button', { name: 'Cancel' }).click()

  // The walkthrough's Edit ticket names the item and goes back to the checklist.
  await entry.click()
  await expect(page.getByRole('heading', { name: 'Edit ticket' })).toBeVisible()
  await expect(page.getByText('Paint', { exact: true })).toBeVisible()
  await expect(page.getByLabel("What's wrong?")).toHaveValue(title)
  await expect(page.getByText(/Opened by Ari Kim from the October walkthrough/)).toBeVisible()
  await testInfo.attach('edit ticket', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByLabel("What's wrong?").fill(`${title}, and a scuffed corner`)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/${FOH}$`))
  await expect(page.getByRole('link', { name: new RegExp(`${title}, and a scuffed corner`) })).toBeVisible()

  // The ticket's own page says where it came from and leads back.
  const ticketId = await page
    .getByRole('link', { name: new RegExp(`${title}, and a scuffed corner`) })
    .getAttribute('href')
    .then((href) => href!.split('/').pop()!)
  await page.goto(`/tickets/${ticketId}`)
  await page.getByRole('link', { name: 'From the October walkthrough · Paint' }).click()
  await expect(page).toHaveURL(new RegExp(`/walkthrough/${RANALLIS_OCT}/${FOH}$`))
})
