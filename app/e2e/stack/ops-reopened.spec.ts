import { expect, test, type APIRequestContext, type Browser, type TestInfo } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Ops · Reopened ticket. OT-0988 is only read, since other flows count on it being
 * reopened. Anything changed is a ticket made here by Dana at Porter, closed by Bert and
 * reopened by Dana through the API.
 */

// CI runs in UTC, and this reads dates from the seed.
test.use({ timezoneId: 'America/Chicago' })

const T0988 = '66666666-6666-4666-8666-000000000988'
const BERT = 'bert.velilla@example.com'
const DANA = 'dana.ortiz@example.com'
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

async function rest(request: APIRequestContext, email: string) {
  const token = await tokenFor(request, email)
  return { apikey: KEY, Authorization: `Bearer ${token}` }
}

/** A ticket at Porter, closed with a comment and then reopened with a reason. Returns its id and title. */
async function reopenedTicket(request: APIRequestContext, browser: Browser, testInfo: TestInfo, word: string) {
  const title = `${word} ${testInfo.project.name} ${Date.now() % 100000}`
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, DANA)
  await dana.goto('/tickets/new')
  await dana.getByRole('link', { name: /^Refrigeration/ }).click()
  await dana.getByLabel('Title').fill(title)
  await dana.getByRole('button', { name: 'Submit ticket' }).click()
  await dana.getByRole('link', { name: new RegExp(title) }).click()
  await expect(dana.getByRole('heading', { name: title })).toBeVisible()
  const id = new URL(dana.url()).pathname.split('/').pop()!
  await context.close()

  const closed = await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${id}`, {
    headers: await rest(request, BERT),
    data: { status: 'closed', resolution: 'Swapped the relay.' },
  })
  expect(closed.ok()).toBe(true)
  const reopened = await request.post(`${SUPABASE}/rest/v1/rpc/reopen_ticket`, {
    headers: await rest(request, DANA),
    data: { p_id: id, p_note: 'It is warm again.' },
  })
  expect(reopened.ok()).toBe(true)
  return { id, title }
}

test('a reopened ticket says why it came back and how it ended', async ({ page }, testInfo) => {
  await signIn(page, BERT)
  await page.getByRole('link', { name: /OT-0988/ }).click()
  await expect(page).toHaveURL(new RegExp(`/ops/tickets/${T0988}$`))
  await expect(page.getByRole('heading', { name: 'Door gasket torn' })).toBeVisible()
  await expect(page.getByText(/Federale’s Logan Square.*Walk-in Cooler 1.*Closed Oct 14/)).toBeVisible()

  const flag = page.getByRole('region', { name: 'Reopened' })
  await expect(flag).toContainText('Frost is building on the threshold again')
  await expect(flag).toContainText(/Maya Reyes, Federale’s Logan Square · .* · \d+ days after closing/)

  await expect(page.getByText('Your closing comment')).toBeVisible()
  await expect(page.getByText('Replaced the full door gasket.')).toBeVisible()
  await expect(page.getByText('$245.00')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start work' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close again' })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('reopened', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Start work' }).click()
  const sheet = page.getByRole('dialog', { name: /^Start work on OT-0988\?$/ })
  await expect(sheet.getByRole('button', { name: 'Start work' })).toBeDisabled()
  await sheet.getByLabel('Note for the ticket').fill('   ')
  await expect(sheet.getByRole('button', { name: 'Start work' })).toBeDisabled()
  await page.waitForTimeout(300)
  await testInfo.attach('start-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Close again' }).click()
  const close = page.getByRole('dialog', { name: 'Close again' })
  await expect(close.getByRole('button', { name: 'Send and close' })).toBeDisabled()
  await page.waitForTimeout(300)
  await testInfo.attach('close-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await close.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page).toHaveURL(/\/ops$/)
})

test('Start work puts you on it, and the note reaches the restaurant', async ({ page, browser, request }, testInfo) => {
  const { id, title } = await reopenedTicket(request, browser, testInfo, 'Start work')
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${id}`)
  await expect(page.getByRole('region', { name: 'Reopened' })).toContainText('It is warm again.')

  await page.getByRole('button', { name: 'Start work' }).click()
  const sheet = page.getByRole('dialog', { name: /^Start work on OT-\d+\?$/ })
  await sheet.getByLabel('Note for the ticket').fill('Checking the relay again.')
  await sheet.getByRole('button', { name: 'Start work' }).click()

  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Work started' })).toBeVisible()
  await expect(page.getByText('You started work · In progress')).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('started', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Go to ticket' }).click()
  await expect(page.getByRole('button', { name: /^Status/ })).toContainText('In progress')
  await expect(page.getByText('On it', { exact: true }).locator('..')).toContainText('You')
  await expect(page.getByRole('log', { name: 'Ticket updates' }).getByText('Checking the relay again.')).toBeVisible()

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, DANA)
  await dana.goto(`/tickets/${id}`)
  await expect(dana.getByRole('heading', { name: title })).toBeVisible()
  await expect(dana.getByText('Checking the relay again.')).toBeVisible()
  await context.close()
})

test('Close again sends the reply, and work can still start after it', async ({ page, browser, request }, testInfo) => {
  const { id, title } = await reopenedTicket(request, browser, testInfo, 'Close again')
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${id}`)

  await page.getByRole('button', { name: 'Close again' }).click()
  const close = page.getByRole('dialog', { name: 'Close again' })
  await close.getByLabel('Message').fill('That is a new problem, please open a ticket for it.')
  await close.getByRole('button', { name: 'Send and close' }).click()

  await expect(close).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Closed again.' })).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('closed-again', { body: await page.screenshot(), contentType: 'image/png' })

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const dana = await context.newPage()
  await signIn(dana, DANA)
  await dana.goto(`/tickets/${id}`)
  await expect(dana.getByRole('heading', { name: 'Closed ticket' })).toBeVisible()
  await expect(dana.getByText('That is a new problem, please open a ticket for it.')).toBeVisible()
  await context.close()

  await page.getByRole('button', { name: 'Start work anyway' }).click()
  const sheet = page.getByRole('dialog', { name: /^Start work on OT-\d+\?$/ })
  await sheet.getByLabel('Note for the ticket').fill('Looking anyway.')
  await sheet.getByRole('button', { name: 'Start work' }).click()
  await page.getByRole('button', { name: 'Go to ticket' }).click()
  await expect(page.getByRole('button', { name: /^Status/ })).toContainText('In progress')

  await page.getByRole('link', { name: 'Back to dashboard' }).click()
  await expect(page.getByRole('link', { name: new RegExp(title) })).toContainText('In progress')
})

test('Start work anyway on a closed ticket brings back its ordinary screen', async ({
  page,
  browser,
  request,
}, testInfo) => {
  const { id } = await reopenedTicket(request, browser, testInfo, 'Anyway')
  const closed = await request.patch(`${SUPABASE}/rest/v1/tickets?id=eq.${id}`, {
    headers: await rest(request, BERT),
    data: { status: 'closed', resolution: 'Second fix.' },
  })
  expect(closed.ok()).toBe(true)

  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${id}`)
  await expect(page.getByText('Second fix.')).toBeVisible()
  await page.getByRole('button', { name: 'Start work anyway' }).click()
  const sheet = page.getByRole('dialog', { name: /^Start work on OT-\d+\?$/ })
  await sheet.getByLabel('Note for the ticket').fill('Back on it.')
  await sheet.getByRole('button', { name: 'Start work' }).click()
  await expect(page.getByRole('button', { name: /^Status/ })).toContainText('In progress')
})

test('a failure says so and keeps the sheet and what was written', async ({ page }) => {
  await page.route('**/rest/v1/rpc/start_ticket_work', (route) =>
    route.fulfill({ status: 500, json: { message: 'nope' } }),
  )
  await signIn(page, BERT)
  await page.goto(`/ops/tickets/${T0988}`)
  await page.getByRole('button', { name: 'Start work' }).click()
  const sheet = page.getByRole('dialog', { name: /^Start work on OT-0988\?$/ })
  await sheet.getByLabel('Note for the ticket').fill('Still here')
  await sheet.getByRole('button', { name: 'Start work' }).click()
  await expect(sheet.getByRole('alert')).toContainText("That didn't go through")
  await expect(sheet.getByLabel('Note for the ticket')).toHaveValue('Still here')
})
