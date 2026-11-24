import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Leadership files tickets (OT-170). Lee files one from the Overview through a Reporter's
 * Create ticket screens, finds it under Filed by you, posts on it, edits it, closes it and
 * reopens it, with no read-only band on the ticket. From a restaurant's page New ticket
 * starts with that restaurant picked. Tickets are never deleted, so everything is filed at
 * Ranalli's, which no other test counts.
 */

const LEE = 'lee.chen@example.com'
const RANALLIS = '11111111-1111-4111-8111-000000000004'

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

test('leadership files a ticket from the Overview, posts on it, edits, closes and reopens it', async ({
  page,
}, testInfo) => {
  const title = `Lobby door sticks ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, LEE)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await page.getByRole('link', { name: 'New ticket' }).click()

  // A Reporter's Create ticket, under /lead, with the restaurant to pick first.
  await expect(page).toHaveURL(/\/lead\/tickets\/new\?/)
  await expect(page.getByRole('heading', { name: 'Create a ticket' })).toBeVisible()
  await page.getByLabel('Restaurant').selectOption(RANALLIS)
  await page.getByRole('radiogroup', { name: 'Area' }).getByRole('radio', { name: 'Back of House' }).click()
  await shot(page, testInfo, 'create-area')
  await page.getByRole('link', { name: /^Refrigeration/ }).click()
  await expect(page.getByRole('heading', { name: 'New ticket' })).toBeVisible()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill('The front door drags on the frame.')
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  const prompt = page.getByRole('dialog', { name: 'Add a photo and equipment?' })
  await prompt.getByRole('button', { name: 'Proceed without photo or equipment' }).click()

  // Back on the Overview, under Filed by you.
  await expect(page).toHaveURL(/\/lead$/)
  await expect(page.getByRole('status').filter({ hasText: /OT-\d+ created\./ })).toBeVisible()
  const filed = page.getByRole('region', { name: 'Filed by you' })
  const card = filed.getByRole('link', { name: new RegExp(title) })
  await expect(card).toContainText('Ranalli’s Logan Square')
  await expect(card).toContainText('BOH · Refrigeration')
  await shot(page, testInfo, 'filed-by-you')
  await card.click()

  // Their ticket: no band, the message box, and Edit and Close in the menu.
  await expect(page).toHaveURL(/\/lead\/tickets\/[0-9a-f-]{36}$/)
  const ticketUrl = page.url()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('READ-ONLY VIEW')).toHaveCount(0)
  await expect(page.getByText(/You can view this ticket but not change it/)).toHaveCount(0)
  const update = `Still sticking at lunch ${Date.now() % 100000}`
  await page.getByRole('textbox', { name: /^Write an update for/ }).fill(update)
  await page.getByRole('button', { name: 'Post update' }).click()
  await expect(page.getByText(update)).toBeVisible()
  await shot(page, testInfo, 'ticket')

  const edited = `${title} (front)`
  await page.getByRole('button', { name: 'More options for this ticket' }).click()
  await page.getByRole('menuitem', { name: 'Edit ticket' }).click()
  await expect(page).toHaveURL(/\/lead\/tickets\/[0-9a-f-]{36}\/edit$/)
  await page.getByLabel('Title').fill(edited)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(ticketUrl)
  await expect(page.getByRole('heading', { name: edited })).toBeVisible()

  // Close it with a comment; the message box goes and Reopen takes its place.
  await page.getByRole('button', { name: 'More options for this ticket' }).click()
  await page.getByRole('menuitem', { name: 'Close ticket' }).click()
  const confirm = page.getByRole('dialog', { name: /^Close OT-\d+\?$/ })
  await confirm.getByLabel(/Comment/).fill('Fixed the hinge ourselves.')
  await confirm.getByRole('button', { name: 'Close ticket' }).click()
  await expect(page.getByRole('status').filter({ hasText: /OT-\d+ closed\./ })).toBeVisible()
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: /^Write an update for/ })).toHaveCount(0)
  await shot(page, testInfo, 'closed')

  await page.getByRole('button', { name: 'Reopen ticket' }).click()
  const ask = page.getByRole('dialog', { name: 'Is the problem back?' })
  await ask.getByLabel("What's happening?").fill('The hinge slipped again.')
  await ask.getByRole('button', { name: 'Reopen ticket' }).click()
  await expect(page.getByRole('status').filter({ hasText: /OT-\d+ reopened/ })).toBeVisible()
  await expect(page.getByText('Reopened', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: /^Write an update for/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reopen ticket' })).toHaveCount(0)
})

test('New ticket on a restaurant’s page starts with that restaurant, and Back returns to it', async ({ page }) => {
  await signIn(page, LEE)
  await page.goto(`/lead/restaurants/${RANALLIS}`)
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await page.getByRole('link', { name: 'New ticket' }).click()
  await expect(page.getByRole('heading', { name: 'Create a ticket' })).toBeVisible()
  await expect(page.getByLabel('Restaurant')).toHaveValue(RANALLIS)
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/lead/restaurants/${RANALLIS}$`))
})
