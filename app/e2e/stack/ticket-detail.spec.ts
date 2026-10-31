import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Manager · Ticket against the seed. Maya's tickets are only read, since the Open
 * tickets tests count on their times. Anything posted goes on Ari's OT-1045.
 */

// The thread shows times in the device's zone, and the seed's are in Chicago.
test.use({ timezoneId: 'America/Chicago' })

const T1042 = '66666666-6666-4666-8666-000000001042'
const T0988 = '66666666-6666-4666-8666-000000000988'
const T1045 = '66666666-6666-4666-8666-000000001045'

test('a ticket shows its header, description, equipment and thread, without internal notes', async ({
  page,
}, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.getByRole('link', { name: /^OT-1042/ }).click()
  await expect(page).toHaveURL(new RegExp(`/tickets/${T1042}$`))

  await expect(page.getByRole('heading', { name: 'Walk-in cooler not holding temp' })).toBeVisible()
  await expect(page.getByText('OT-1042')).toBeVisible()
  await expect(page.getByText('In progress', { exact: true })).toBeVisible()
  await expect(page.getByText('URGENT')).toBeVisible()
  await expect(page.getByText('Federale’s Logan Square › BOH › Refrigeration')).toBeVisible()
  await expect(page.getByText('Walk-in reading 46°F since this morning.')).toBeVisible()
  await expect(page.getByText('Walk-in Cooler 1')).toBeVisible()
  await expect(page.getByText('Kolpak ·')).toBeVisible()

  const log = page.getByRole('log', { name: 'Ticket updates' })
  await expect(page.getByText('Updates · 3')).toBeVisible()
  await expect(log.getByText(/^Opened by you · Oct 19, 2026, 9:12 AM$/)).toBeVisible()
  await expect(log.getByText(/^Bert Velilla assigned · status In progress · 9:40 AM$/)).toBeVisible()
  await expect(log.getByText('Bert Velilla, Ops').first()).toBeVisible()
  await expect(log.getByText('You', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Coldline quoted')).toHaveCount(0) // an internal note
  await expect(page.getByRole('navigation', { name: 'Manager' })).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('ticket', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('link', { name: 'Back to open tickets' }).click()
  await expect(page).toHaveURL(/\/tickets$/)
})

test('a reopen reason reads as the person who wrote it', async ({ page }) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/tickets/${T0988}`)
  const log = page.getByRole('log', { name: 'Ticket updates' })
  await expect(log.getByText(/^Reopened by you · /)).toBeVisible()
  await expect(log.getByText('Frost is building on the threshold again')).toBeVisible()
})

test('a manager posts an update, it joins the thread and moves the ticket up the list', async ({ page }, testInfo) => {
  const text = `Fan still rattling ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.goto(`/tickets/${T1045}`)
  const send = page.getByRole('button', { name: 'Post update' })
  await expect(send).toBeDisabled()

  const field = page.getByRole('textbox', { name: 'Write an update for Ops' })
  await field.fill('   ')
  await expect(send).toBeDisabled()
  await field.fill(text)
  await send.click()

  const log = page.getByRole('log', { name: 'Ticket updates' })
  await expect(log.getByText(text)).toBeVisible()
  await expect(field).toHaveValue('')
  await expect(log.getByText('Just now').last()).toBeVisible()

  await page.getByRole('link', { name: 'Back to open tickets' }).click()
  const first = page.getByRole('link', { name: /^OT-/ }).first()
  await expect(first).toContainText('OT-1045')
  await expect(first).toContainText(/Updated (just now|\dm ago)/)
})

test('a failed post keeps what was written', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  await page.goto(`/tickets/${T1045}`)
  const field = page.getByRole('textbox', { name: 'Write an update for Ops' })
  await field.fill('This should stay')

  await page.route('**/rest/v1/ticket_updates*', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 500, json: { message: 'nope' } }) : route.continue(),
  )
  await page.getByRole('button', { name: 'Post update' }).click()
  await expect(page.getByRole('alert')).toContainText("Couldn't post that yet.")
  await expect(field).toHaveValue('This should stay')

  await field.fill('This should stay, edited')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('another restaurant’s ticket and a bad address are both a 404', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  await page.goto(`/tickets/${T1042}`)
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
  await page.goto('/tickets/not-a-ticket')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})
