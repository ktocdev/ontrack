import { expect, test, type Page } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/** Manager · In-house tasks against the seed: Maya manages Logan Square, Ari manages Ranalli's. */

const openInHouse = async (page: Page, email: string) => {
  await signIn(page, email)
  await page.getByRole('link', { name: /^In-house/ }).click()
  await expect(page.getByRole('heading', { name: 'In-house tasks' })).toBeVisible()
}
const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const MAYA = '22222222-2222-4222-8222-000000000001'
const LOGAN_SQUARE = '11111111-1111-4111-8111-000000000001'

const box = (page: Page, title: string) => page.getByRole('checkbox', { name: `Mark complete: ${title}` })
const trash = (page: Page, title: string) => page.getByRole('button', { name: `Delete in-house task: ${title}` })

test('a manager sees the tasks to fix in the board order, and Front and Back narrow them', async ({
  page,
}, testInfo) => {
  await openInHouse(page, 'maya.reyes@example.com')
  const tabs = page.getByRole('navigation', { name: 'Ticket or in-house view' })
  await expect(tabs.getByRole('link', { name: 'Tickets 5' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'In-house 5' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: 'Open tickets', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('To fix · 5')).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(5)
  await expect(page.getByRole('checkbox').first()).toHaveAccessibleName(
    'Mark complete: Replace 2 bulbs over booths 4–6',
  )
  await expect(page.getByRole('checkbox').nth(3)).toHaveAccessibleName('Mark complete: Clear boxes from utility closet')
  await expect(page.getByText('Sep walkthrough · FOH › Aesthetics › Paint')).toBeVisible()
  await expect(page.getByText('Closed · 1')).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('in-house', { body: await page.screenshot(), contentType: 'image/png' })

  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.getByRole('radiogroup', { name: 'Area' })).toHaveCount(0)
})

test('another restaurant’s manager sees none of them', async ({ page }) => {
  await openInHouse(page, 'ari.kim@example.com')
  await expect(page.getByText('Nothing to fix right now.')).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
})

test('checking a task moves it to Closed and it stays there, and unchecking brings it back', async ({ page }) => {
  await openInHouse(page, 'maya.reyes@example.com')
  const title = 'Tighten wobbly 2-top at table 14'
  await box(page, title).click()
  await expect(page.getByText('To fix · 4')).toBeVisible()
  await expect(page.getByText('Closed · 2')).toBeVisible()
  await expect(page.getByRole('link', { name: 'In-house 4' })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Closed · 2')).toBeVisible()
  await page.getByText('Closed · 2').click()
  await expect(box(page, title)).toBeChecked()
  await expect(page.getByText('Oct walkthrough · FOH › Aesthetics › Surfaces and seating · Completed')).toBeVisible()
  await expect(trash(page, title)).toHaveCount(0)

  await box(page, title).click()
  await expect(page.getByText('To fix · 5')).toBeVisible()
  await expect(trash(page, title)).toBeVisible()
})

test('a save that fails puts the task back and says so', async ({ page }) => {
  await openInHouse(page, 'maya.reyes@example.com')
  await page.route('**/rest/v1/rpc/set_inhouse_fix_done', (route) =>
    route.fulfill({ status: 500, json: { message: 'nope' } }),
  )
  await box(page, 'Replace 2 bulbs over booths 4–6').click()
  await expect(page.getByText('Couldn’t save that.')).toBeVisible()
  await expect(page.getByText('To fix · 5')).toBeVisible()
  await expect(box(page, 'Replace 2 bulbs over booths 4–6')).not.toBeChecked()
})

test('deleting an open task asks first, then removes it for good', async ({ page, request, browserName }, testInfo) => {
  // Its own task, since the seeded ones are what the other flows count.
  const title = `Delete me ${browserName}`
  const token = await tokenFor(request, 'maya.reyes@example.com')
  const added = await request.post(`${SUPABASE}/rest/v1/inhouse_fixes`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
    data: { restaurant_id: LOGAN_SQUARE, title, created_by: MAYA },
  })
  expect(added.ok()).toBe(true)
  await openInHouse(page, 'maya.reyes@example.com')

  await trash(page, title).click()
  const sheet = page.getByRole('dialog', { name: 'Delete this in-house task?' })
  await expect(sheet.getByText(`"${title}" will be removed.`)).toBeVisible()
  await expect(sheet.getByText('This is permanent and cannot be undone.')).toBeVisible()
  await page.waitForTimeout(300)
  await testInfo.attach('delete-sheet', { body: await page.screenshot(), contentType: 'image/png' })

  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(box(page, title)).toBeVisible()

  await trash(page, title).click()
  await sheet.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('In-house task deleted.')).toBeVisible()
  await expect(box(page, title)).toHaveCount(0)
  await expect(page.getByText('To fix · 5')).toBeVisible()

  await page.reload()
  await expect(page.getByText('To fix · 5')).toBeVisible()
  await expect(box(page, title)).toHaveCount(0)
})

test('a delete that fails stays on the sheet and says why', async ({ page }) => {
  await openInHouse(page, 'maya.reyes@example.com')
  await page.route('**/rest/v1/rpc/delete_inhouse_fix', (route) =>
    route.fulfill({ status: 400, json: { code: '23514', message: 'a checked-off task stays on the record' } }),
  )
  await trash(page, 'Replace 2 bulbs over booths 4–6').click()
  const sheet = page.getByRole('dialog', { name: 'Delete this in-house task?' })
  await sheet.getByRole('button', { name: 'Delete' }).click()
  await expect(sheet.getByText("Couldn't delete this yet.")).toBeVisible()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(box(page, 'Replace 2 bulbs over booths 4–6')).toBeVisible()
})

test('a manager adds a task by hand, which says who added it, and walkthrough tasks carry the tag', async ({
  page,
  browserName,
}, testInfo) => {
  const title = `Clean the grease under the prep table ${browserName}`
  await openInHouse(page, 'maya.reyes@example.com')
  const first = page.getByRole('checkbox', { name: 'Mark complete: Replace 2 bulbs over booths 4–6' })
  await expect(first.locator('xpath=..').getByText('Walkthrough', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Add in-house task' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add in-house task' })
  await expect(sheet.getByRole('radio', { name: 'Front of House' })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByRole('button', { name: 'Add task' }).click()
  await expect(sheet.getByText('Say what needs doing.')).toBeVisible()

  await sheet.getByLabel('Task').fill(title)
  await sheet.getByRole('radio', { name: 'Back of House' }).click()
  await page.waitForTimeout(300)
  await testInfo.attach('add-task-sheet', { body: await page.screenshot(), contentType: 'image/png' })
  await sheet.getByRole('button', { name: 'Add task' }).click()
  await expect(sheet).toHaveCount(0)

  await expect(page.getByText('To fix · 6')).toBeVisible()
  await expect(page.getByRole('link', { name: 'In-house 6' })).toBeVisible()
  const row = box(page, title).locator('xpath=..')
  await expect(row.getByText(/^Added by Maya · [A-Z][a-z]{2} \d{1,2}$/)).toBeVisible()
  await expect(row.getByText('Walkthrough', { exact: true })).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('in-house-added', { body: await page.screenshot(), contentType: 'image/png' })

  // Back to the seed's five for the other flows.
  await trash(page, title).click()
  await page.getByRole('dialog', { name: 'Delete this in-house task?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('To fix · 5')).toBeVisible()
})

test('a failed add stays on the sheet and says so', async ({ page }) => {
  await openInHouse(page, 'maya.reyes@example.com')
  await page.route('**/rest/v1/inhouse_fixes*', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 500, json: { message: 'nope' } }) : route.fallback(),
  )
  await page.getByRole('button', { name: 'Add in-house task' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add in-house task' })
  await sheet.getByLabel('Task').fill('Wipe down the walk-in door')
  await sheet.getByRole('button', { name: 'Add task' }).click()
  await expect(sheet.getByText("Couldn't add this task.")).toBeVisible()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('To fix · 5')).toBeVisible()
})
