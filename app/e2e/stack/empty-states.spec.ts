import { expect, test, type Locator } from '@playwright/test'
import { signIn } from './helpers'

/**
 * An empty or error state under a tab screen's header scrolls when it doesn't fit, so its
 * button can't end up behind the tab bar (OT-96 for Contractors, OT-97 for the others,
 * through ScreenEmpty). A small phone, or one turned on its side, stands in for any
 * screen too short for the header and the state together.
 */
const SIDEWAYS = { width: 667, height: 375 }
// A small iPhone inside Safari, where the Contractors header leaves the least room.
const SMALL = { width: 375, height: 548 }

/** Taps a button, which scrolls to it first; the tap fails if the tab bar covers the button. */
const reach = (button: Locator) => button.click({ timeout: 5000 })

test('a contractor search with no match: Clear search is in reach', async ({ page }) => {
  await page.setViewportSize(SMALL)
  await signIn(page, 'bert.velilla@example.com')
  await page.goto('/ops/contractors')
  await page.getByLabel('Search contractors').fill('zzzz')
  await expect(page.getByRole('heading', { name: 'No contractors match "zzzz"' })).toBeVisible()
  // By its text: the search field has a Clear search of its own, named by a label.
  await reach(page.getByText('Clear search', { exact: true }))
  await expect(page.getByRole('article', { name: 'Coldline Refrigeration' })).toBeVisible()
})

for (const screen of [
  { who: 'bert.velilla@example.com', path: '/ops', title: "We couldn't load the dashboard" },
  { who: 'maya.reyes@example.com', path: '/tickets', title: "We couldn't load your tickets" },
])
  test(`${screen.path} when it can't load: Try again is in reach`, async ({ page }) => {
    await page.setViewportSize(SIDEWAYS)
    await signIn(page, screen.who)
    await page.route('**/rest/v1/tickets*', (route) => route.abort())
    await page.goto(screen.path)
    // The list retries a few times before it says so.
    await expect(page.getByRole('heading', { name: screen.title })).toBeVisible({ timeout: 20_000 })
    await page.unroute('**/rest/v1/tickets*')
    await reach(page.getByRole('button', { name: 'Try again' }))
    await expect(page.getByText('OT-1042').first()).toBeVisible()
  })
