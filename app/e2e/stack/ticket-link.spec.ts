import { expect, test, type Page } from '@playwright/test'
import { passTwoStep, SEED_PASSWORD, signIn } from './helpers'

/**
 * A ticket's lasting link, /t/<id>, against the seed: OT-1042 is at Federale's Logan
 * Square, Maya's restaurant. Nothing here changes a ticket.
 */

const T1042 = '66666666-6666-4666-8666-000000001042'
const HEADING = 'Walk-in cooler not holding temp'
const CLOSED_1028 = '66666666-6666-4666-8666-000000001028'
const menu = (page: Page) => page.getByRole('button', { name: 'More options for this ticket' })

async function signInForm(page: Page, email: string) {
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('the link opens the right screen for a manager and for Ops', async ({ page, browser }, testInfo) => {
  await signIn(page, 'maya.reyes@example.com')
  await page.goto(`/t/${T1042}`)
  await expect(page).toHaveURL(new RegExp(`/tickets/${T1042}$`))
  await expect(page.getByRole('heading', { name: HEADING })).toBeVisible()

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
  const ops = await context.newPage()
  await signIn(ops, 'bert.velilla@example.com')
  await ops.goto(`/t/${T1042}`)
  await expect(ops).toHaveURL(new RegExp(`/ops/tickets/${T1042}$`))
  await expect(ops.getByRole('heading', { name: HEADING })).toBeVisible()
  await context.close()
})

test('a signed-out person goes through sign-in and back to the ticket', async ({ page }) => {
  await page.goto(`/t/${T1042}`)
  await signInForm(page, 'bert.velilla@example.com')
  await expect(page).toHaveURL(new RegExp(`/ops/tickets/${T1042}$`))
  await expect(page.getByRole('heading', { name: HEADING })).toBeVisible()
})

test('the link grants nothing: another restaurant’s manager is refused', async ({ page }) => {
  await page.goto(`/t/${T1042}`)
  await signInForm(page, 'dana.ortiz@example.com')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
  await expect(page.getByText(HEADING)).toHaveCount(0)
})

test('a link that is not a ticket says so', async ({ page }) => {
  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/t/not-a-ticket')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})

test('admin and leadership have no ticket screen yet, and see nothing of the ticket', async ({ page }, testInfo) => {
  await page.goto(`/t/${T1042}`)
  await signInForm(page, 'admin@example.com')
  await passTwoStep(page)
  await expect(page.getByRole('heading', { name: "Tickets don't open here yet" })).toBeVisible()
  await expect(page.getByText(HEADING)).toHaveCount(0)
  await page.waitForTimeout(300)
  await testInfo.attach('no-screen', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('link', { name: 'Go to my home screen' }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
})

test.describe('Share link', () => {
  test('on a computer it copies the link and confirms, for a manager and on a closed ticket', async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            ;(window as unknown as { copied?: string }).copied = text
            return Promise.resolve()
          },
        },
      })
    })
    await signIn(page, 'maya.reyes@example.com')
    await page.goto(`/tickets/${T1042}`)
    await menu(page).click()
    await page.waitForTimeout(200)
    await testInfo.attach('menu', { body: await page.screenshot(), contentType: 'image/png' })
    await page.getByRole('menuitem', { name: 'Share link' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Link copied.' })).toBeVisible()
    const origin = new URL(page.url()).origin
    expect(await page.evaluate(() => (window as unknown as { copied?: string }).copied)).toBe(`${origin}/t/${T1042}`)

    await page.goto(`/tickets/${CLOSED_1028}`)
    await expect(page.getByRole('heading', { name: 'Closed ticket' })).toBeVisible()
    await menu(page).click()
    await page.getByRole('menuitem', { name: 'Share link' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Link copied.' })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { copied?: string }).copied)).toBe(
      `${origin}/t/${CLOSED_1028}`,
    )
  })

  test('on a phone it opens the share sheet, for Ops and on a closed ticket', async ({ page }) => {
    await page.addInitScript(() => {
      const realMatch = window.matchMedia.bind(window)
      window.matchMedia = (query: string) =>
        query === '(pointer: coarse)' ? ({ ...realMatch(query), matches: true } as MediaQueryList) : realMatch(query)
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (data: ShareData) => {
          ;(window as unknown as { shared?: ShareData }).shared = data
          return Promise.resolve()
        },
      })
    })
    await signIn(page, 'bert.velilla@example.com')
    await page.goto(`/ops/tickets/${T1042}`)
    await menu(page).click()
    await page.getByRole('menuitem', { name: 'Share link' }).click()
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { shared?: ShareData }).shared))
      .toEqual({ title: `OT-1042 · ${HEADING}`, url: `${new URL(page.url()).origin}/t/${T1042}` })
    await expect(page.getByRole('status').filter({ hasText: 'Link copied.' })).toHaveCount(0)

    await page.goto(`/ops/tickets/${CLOSED_1028}`)
    await expect(page.getByRole('heading', { name: 'Booth 12 upholstery torn' })).toBeVisible()
    await expect(menu(page)).toBeVisible()
  })
})

test('a narrow phone still fits the manager’s ticket header', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await signIn(page, 'maya.reyes@example.com')
  await page.goto('/tickets/66666666-6666-4666-8666-000000001037') // Waiting on parts, the longest pill
  await expect(menu(page)).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
  await expect(menu(page)).toBeInViewport({ ratio: 1 })
  await page.waitForTimeout(300)
  await testInfo.attach('narrow', { body: await page.screenshot(), contentType: 'image/png' })
})
