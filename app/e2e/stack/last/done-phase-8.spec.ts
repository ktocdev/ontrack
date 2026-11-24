import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { openRestaurants, signIn } from '../helpers'

/**
 * Phase 8's done test as one flow (OT-163): the desktop view. Maya files a ticket on her
 * phone, whose layout is as it was: the tab bar, no sidebar. Bert, on a laptop at 1440 px,
 * works it without leaving the dashboard: it opens beside the list, he marks it In progress,
 * posts an update and closes it, with the sidebar and Dashboard lit throughout, and the card
 * leaves the dashboard for Closed tickets. Lee, on a laptop too, reads the Overview and then
 * a restaurant's tickets with one open beside them.
 *
 * Under last/: it files and closes a ticket the other flows' counts don't expect. The title
 * carries the run, so both browsers can run it on one stack.
 */

test.use({ timezoneId: 'America/Chicago' })

const MAYA = 'maya.reyes@example.com'
const BERT = 'bert.velilla@example.com'
const LEE = 'lee.chen@example.com'
const LAPTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

test('the desktop view: Bert works a ticket beside the dashboard, Lee reads beside a restaurant, a phone is unchanged', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const title = `Hood fan rattling ${testInfo.project.name} ${Date.now() % 1_000_000}`
  const update = 'Tech booked for tomorrow at 9.'
  const baseURL = testInfo.project.use.baseURL

  // 1. Maya files it on her phone, which has the tab bar and no sidebar, as before.
  const phone = await browser.newContext({ baseURL, viewport: PHONE, storageState: testInfo.project.use.storageState })
  const maya = await phone.newPage()
  try {
    await signIn(maya, MAYA)
    await expect(maya.getByTestId('tab-bar')).toBeVisible()
    await expect(maya.locator('aside')).toHaveCount(0)
    await maya.getByRole('link', { name: 'Create ticket', exact: true }).click()
    await maya.getByRole('radio', { name: 'Back of House' }).click()
    await maya.getByRole('link', { name: /^Refrigeration/ }).click()
    await maya.getByLabel('Title').fill(title)
    await maya.getByLabel('Description').fill('Loud rattle from the hood fan over the line.')
    await maya.getByRole('button', { name: 'Submit ticket' }).click()
    await maya.getByRole('button', { name: 'Proceed without photo' }).click()
    await expect(maya.getByRole('link', { name: new RegExp(title) })).toBeVisible()
    await shot(maya, testInfo, 'maya-phone')
  } finally {
    await phone.close()
  }

  // 2. Bert on a laptop: the dashboard on its own, with the sidebar.
  await page.setViewportSize(LAPTOP)
  await signIn(page, BERT)
  await openRestaurants(page)
  const nav = page.getByRole('navigation', { name: 'Operations' })
  const dashboardTab = nav.getByRole('link', { name: 'Dashboard' })
  const list = page.locator('[data-split-list]')
  await expect(page.locator('aside')).toBeVisible()
  await expect(page.getByTestId('tab-bar')).toBeHidden()
  await expect(list).toHaveAttribute('data-split-list', 'alone')

  // 3. The ticket opens beside the list, which stays, with its card marked.
  const card = list.getByRole('link', { name: new RegExp(title) })
  await card.click()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
  await expect(list).toHaveAttribute('data-split-list', 'beside')
  await expect(list.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(card).toHaveAttribute('aria-current', 'page')
  await expect(dashboardTab).toHaveAttribute('aria-current', 'page')
  await shot(page, testInfo, 'bert-ticket-beside-dashboard')

  // 4. In progress, then an update, still beside the list.
  const details = page.getByRole('region', { name: 'Details' })
  await details.getByRole('button', { name: /^Status/ }).click()
  await page.getByRole('menuitemradio', { name: 'In progress' }).click()
  await expect(details.getByRole('button', { name: /^Status/ })).toContainText('In progress')
  await expect(card).toContainText('In progress')
  await details.getByRole('button', { name: 'Add update' }).click()
  await details.getByRole('textbox', { name: 'Write an update the restaurant can see' }).fill(update)
  await details.getByRole('button', { name: 'Post update' }).click()
  await expect(details.getByRole('log', { name: 'Ticket updates' }).getByText(update)).toBeVisible()
  await expect(list.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.locator('aside')).toBeVisible()

  // 5. He closes it in a centered dialog; the dashboard has the column again, without the card.
  await details.getByRole('button', { name: /^Status/ }).click()
  await page.getByRole('menuitem', { name: 'Close ticket' }).click()
  const sheet = page.getByRole('dialog', { name: /^Close OT-\d+\?$/ })
  expect((await sheet.boundingBox())!.width).toBe(440)
  await sheet.getByLabel('Comment').fill('Fan belt replaced.')
  await sheet.getByRole('button', { name: 'Close ticket' }).click()
  await expect(page).toHaveURL(/\/ops$/)
  await expect(list).toHaveAttribute('data-split-list', 'alone')
  await expect(list.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
  await expect(page.locator('aside')).toBeVisible()
  await expect(dashboardTab).toHaveAttribute('aria-current', 'page')

  // 6. It is on Closed tickets, and opens beside that list.
  await list.getByRole('button', { name: 'More ticket options' }).click()
  await page.getByRole('menuitem', { name: 'View Closed Tickets' }).click()
  await expect(page.getByRole('heading', { name: 'Closed tickets' })).toBeVisible()
  await list.getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByText('Fan belt replaced.')).toBeVisible()
  await expect(list.getByRole('heading', { name: 'Closed tickets' })).toBeVisible()
  await expect(dashboardTab).toHaveAttribute('aria-current', 'page')
  await shot(page, testInfo, 'bert-closed-beside-list')

  // 7. Lee on a laptop: the Overview, then a restaurant's tickets with one open beside them.
  const laptop = await browser.newContext({
    baseURL,
    viewport: LAPTOP,
    storageState: testInfo.project.use.storageState,
  })
  const lee = await laptop.newPage()
  try {
    await signIn(lee, LEE)
    await expect(lee.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(lee.locator('aside')).toBeVisible()
    await shot(lee, testInfo, 'lee-overview')
    await lee.getByRole('navigation', { name: 'Leadership' }).getByRole('link', { name: 'Restaurants' }).click()
    const leeList = lee.locator('[data-split-list]')
    await expect(leeList).toHaveAttribute('data-split-list', 'alone')
    const leeCard = leeList.locator('a[href^="/lead/tickets/"]:not([href^="/lead/tickets/new"])').first()
    await leeCard.click()
    await expect(lee).toHaveURL(/\/lead\/tickets\//)
    await expect(leeList).toHaveAttribute('data-split-list', 'beside')
    await expect(leeCard).toHaveAttribute('aria-current', 'page')
    await expect(lee.getByText('READ-ONLY VIEW')).toHaveCount(0)
    await shot(lee, testInfo, 'lee-ticket-beside-restaurant')

    // The X closes it, back to the restaurant on its own.
    await lee.getByRole('link', { name: 'Close panel', exact: true }).click()
    await expect(leeList).toHaveAttribute('data-split-list', 'alone')
  } finally {
    await laptop.close()
  }
})
