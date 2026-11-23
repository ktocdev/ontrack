import { expect, test } from '@playwright/test'
import { signIn, tokenFor } from './helpers'

/**
 * Manager · Create ticket against the seed. Tickets are never deleted, so everything
 * here is made as Ari at Ranalli's, which no other test counts.
 */

const SUPABASE = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

test('a manager picks a category and creates a ticket, and another manager cannot see it', async ({
  page,
  request,
}, testInfo) => {
  const title = `Ice bin leaking ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.getByRole('navigation', { name: 'Manager' }).getByRole('link', { name: 'Create ticket' }).click()
  await expect(page.getByRole('heading', { name: 'Create a ticket' })).toBeVisible()
  await expect(page.getByText(/QR/)).toHaveCount(0)

  const area = page.getByRole('radiogroup', { name: 'Area' })
  await expect(area.getByRole('radio', { name: 'Front of House' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('link', { name: /^Retractable roofs & windows/ })).toBeVisible()
  await area.getByRole('radio', { name: 'Back of House' }).click()
  await page.waitForTimeout(300)
  await testInfo.attach('create-area', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('link', { name: /^Refrigeration/ }).click()
  await expect(page.getByRole('heading', { name: 'New ticket' })).toBeVisible()
  await expect(page.getByText('Back of House › Refrigeration')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Manager' })).toHaveCount(0)

  const submit = page.getByRole('button', { name: 'Submit ticket' })
  await expect(submit).toBeDisabled()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill('Puddle under the bin by open.')
  await page.getByRole('radio', { name: 'Low' }).click()

  // Tapping the chosen unit again clears it; only this restaurant's units are offered.
  const units = page.getByRole('radiogroup', { name: 'Equipment' }).getByRole('radio')
  await expect(page.getByRole('radio', { name: /Walk-in Cooler 1/ })).toHaveCount(0)
  await units.first().click()
  await expect(units.first()).toHaveAttribute('aria-checked', 'true')
  await units.first().click()
  await expect(units.first()).toHaveAttribute('aria-checked', 'false')
  await units.first().click()
  await testInfo.attach('create-form', { body: await page.screenshot(), contentType: 'image/png' })

  // With no photo, Submit asks for one first (OT-77).
  await submit.click()
  const prompt = page.getByRole('dialog', { name: 'Add a photo?' })
  await expect(prompt).toContainText('It is best practice to include a photo with a ticket.')
  await expect(prompt.getByRole('button', { name: 'Open Camera' })).toBeVisible()
  await page.waitForTimeout(250)
  await testInfo.attach('photo-prompt', { body: await page.screenshot(), contentType: 'image/png' })
  await prompt.getByRole('button', { name: 'Proceed without photo' }).click()
  await expect(page).toHaveURL(/\/tickets$/)
  await expect(page.getByRole('status').filter({ hasText: /OT-\d+ created\./ })).toBeVisible()
  const card = page.getByRole('link', { name: new RegExp(title) })
  await expect(card).toContainText('Back of House · Refrigeration')
  await expect(card).toContainText('Not picked up yet')
  await expect(card).toContainText('New ticket.')

  const rows = async (email: string) => {
    const token = await tokenFor(request, email)
    const res = await request.get(
      `${SUPABASE}/rest/v1/tickets?title=eq.${encodeURIComponent(title)}&select=urgency,status,description,equipment_id,restaurants(name)`,
      { headers: { apikey: KEY, Authorization: `Bearer ${token}` } },
    )
    return (await res.json()) as Record<string, unknown>[]
  }
  const [saved] = await rows('ari.kim@example.com')
  expect(saved).toMatchObject({
    urgency: 'low',
    status: 'open',
    description: 'Puddle under the bin by open.',
    restaurants: { name: 'Ranalli’s Logan Square' },
  })
  expect(saved!.equipment_id).toBeTruthy()
  expect(await rows('maya.reyes@example.com')).toEqual([])
})

test('a failed save keeps everything and says so', async ({ page }, testInfo) => {
  const title = `Hood light out ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/tickets/new?area=boh')
  await page.getByRole('link', { name: /^Ventilation/ }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill('Left side of the hood.')
  await page.getByRole('radio', { name: 'Urgent' }).click()

  await page.route('**/rest/v1/tickets*', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 500, json: { message: 'nope' } }) : route.continue(),
  )
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await page.getByRole('button', { name: 'Proceed without photo' }).click()
  await expect(page.getByRole('alert')).toContainText("Couldn't save yet.")
  await expect(page.getByRole('alert')).toContainText('Everything you entered is still here.')
  await expect(page.getByLabel('Title')).toHaveValue(title)
  await expect(page.getByLabel('Description')).toHaveValue('Left side of the hood.')
  await expect(page.getByRole('radio', { name: 'Urgent' })).toHaveAttribute('aria-checked', 'true')
  await page.waitForTimeout(300)
  await testInfo.attach('save-failed', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Think this is wrong? Report a problem' }).click()
  await expect(page.getByRole('dialog', { name: 'Report a problem' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  await page.unroute('**/rest/v1/tickets*')
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await page.getByRole('button', { name: 'Proceed without photo' }).click()
  await expect(page).toHaveURL(/\/tickets$/)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
})

test('coming back from the form keeps the area, and a bad category is a 404', async ({ page }) => {
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/tickets/new')
  await page.getByRole('link', { name: /^Lighting/ }).click()
  await expect(page.getByText('Front of House › Lighting')).toBeVisible()
  await page.getByRole('link', { name: 'Back to categories' }).click()
  await expect(page.getByRole('radio', { name: 'Front of House' })).toHaveAttribute('aria-checked', 'true')

  await page.goto('/tickets/new/not-a-category')
  await expect(page.getByRole('heading', { name: "We can't find that page" })).toBeVisible()
})

test('Open Camera adds the photo to the form, and creates nothing until Submit', async ({ page }, testInfo) => {
  const title = `Ice bin cracked ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/tickets/new?area=boh')
  await page.getByRole('link', { name: /^Refrigeration/ }).click()
  await page.getByLabel('Title').fill(title)
  // A unit picked, so the prompt asks only for the photo.
  await page.getByRole('radiogroup', { name: 'Equipment' }).getByRole('radio').first().click()
  const created: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/tickets')) created.push(r.url())
  })

  // Swiping the prompt away, or closing the camera with nothing, leaves the form as it was.
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Add a photo?' })).toHaveCount(0)
  await expect(page.getByLabel('Title')).toHaveValue(title)

  await page.getByRole('button', { name: 'Submit ticket' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open Camera' }).click()
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  )
  await (await chooser).setFiles({ name: 'plate.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('dialog', { name: 'Add a photo?' })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Photos to send' }).getByRole('img')).toHaveCount(1)
  expect(created).toEqual([])

  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await expect(page).toHaveURL(/\/tickets$/)
  await expect(page.getByRole('dialog', { name: 'Add a photo?' })).toHaveCount(0)
  expect(created).toHaveLength(1)
})

test('with no unit picked where the category has some, Submit asks for one, once (OT-167)', async ({
  page,
}, testInfo) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  )
  const stamp = `${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')

  // No photo and no unit: one sheet asks for both, and Choose equipment goes to the list.
  await page.goto('/tickets/new?area=boh')
  await page.getByRole('link', { name: /^Refrigeration/ }).click()
  await page.getByLabel('Title').fill(`Cooler door sags ${stamp}`)
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  const both = page.getByRole('dialog', { name: 'Add a photo and equipment?' })
  await expect(both.getByRole('button')).toHaveText([
    'Open Camera',
    'Choose equipment',
    'Proceed without photo or equipment',
    'Photo tips',
  ])
  await page.waitForTimeout(250)
  await testInfo.attach('equipment-prompt-both', { body: await page.screenshot(), contentType: 'image/png' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(150)
  await testInfo.attach('equipment-prompt-both-dark', { body: await page.screenshot(), contentType: 'image/png' })
  await page.emulateMedia({ colorScheme: 'light' })
  await both.getByRole('button', { name: 'Choose equipment' }).click()
  await expect(both).toHaveCount(0)
  const units = page.getByRole('radiogroup', { name: 'Equipment' }).getByRole('radio')
  await expect(units.first()).toBeFocused()
  await units.first().click()

  // With a unit, it is the photo prompt as before.
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await page
    .getByRole('dialog', { name: 'Add a photo?' })
    .getByRole('button', { name: 'Proceed without photo' })
    .click()
  await expect(page).toHaveURL(/\/tickets$/)
  await page.getByRole('link', { name: new RegExp(`Cooler door sags ${stamp}`) }).click()
  await expect(page.locator('a[href^="/equipment/"]')).toBeVisible()

  // A photo and no unit: Attach equipment? alone, and once said no, never again on this form.
  await page.goto('/tickets/new?area=boh')
  await page.getByRole('link', { name: /^Refrigeration/ }).click()
  await page.getByLabel('Title').fill(`Gasket torn ${stamp}`)
  await page.getByLabel('Choose photos').setInputFiles({ name: 'gasket.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('list', { name: 'Photos to send' }).getByRole('img')).toHaveCount(1)
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  const unit = page.getByRole('dialog', { name: 'Attach equipment?' })
  await expect(unit.getByRole('button')).toHaveText(['Choose equipment', 'Proceed without equipment'])
  await page.waitForTimeout(250)
  await testInfo.attach('equipment-prompt', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Escape')
  await expect(unit).toHaveCount(0)
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await expect(page).toHaveURL(/\/tickets$/)
  await expect(page.getByRole('status').filter({ hasText: /OT-\d+ created\./ })).toBeVisible()

  // A category with no units here asks nothing about equipment.
  await page.goto('/tickets/new?area=it')
  await page.getByRole('link', { name: /^Website/ }).click()
  await page.getByLabel('Title').fill(`Menu page is old ${stamp}`)
  await expect(page.getByRole('radiogroup', { name: 'Equipment' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await expect(page.getByRole('dialog', { name: 'Add a photo?' })).toBeVisible()
})

test('Photo tips opens from beside Add photo and from the photo prompt', async ({ page }, testInfo) => {
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/tickets/new?area=boh')
  await page.getByRole('link', { name: /^Refrigeration/ }).click()
  await page.getByLabel('Title').fill('Photo tips check')
  // A unit picked, so the prompt asks only for the photo.
  await page.getByRole('radiogroup', { name: 'Equipment' }).getByRole('radio').first().click()

  await page.getByRole('button', { name: 'Photo tips' }).click()
  const tips = page.getByRole('dialog', { name: 'Photo tips' })
  await expect(tips.getByRole('img', { name: /Example photo/ })).toBeVisible()
  await expect(tips.getByRole('listitem')).toHaveCount(4)
  await expect(tips).toContainText('Safety first.')
  await page.waitForTimeout(250)
  await testInfo.attach('photo-tips', { body: await page.screenshot(), contentType: 'image/png' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(150)
  await testInfo.attach('photo-tips-dark', { body: await page.screenshot(), contentType: 'image/png' })
  await page.emulateMedia({ colorScheme: 'light' })
  await tips.getByRole('button', { name: 'Got it' }).click()
  await expect(tips).toHaveCount(0)

  // From the prompt, the tips take its place, and Got it brings it back.
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  const prompt = page.getByRole('dialog', { name: 'Add a photo?' })
  await prompt.getByRole('button', { name: 'Photo tips' }).click()
  await expect(prompt).toHaveCount(0)
  await page.getByRole('dialog', { name: 'Photo tips' }).getByRole('button', { name: 'Got it' }).click()
  await expect(prompt).toBeVisible()
  await expect(page).toHaveURL(/\/tickets\/new\//)
})

test('IT is a third area, with its own categories, and a ticket under it says IT', async ({ page }, testInfo) => {
  const title = `Receipt printer offline ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, 'ari.kim@example.com')
  await page.goto('/tickets/new')
  const area = page.getByRole('radiogroup', { name: 'Area' })
  await expect(area.getByRole('radio')).toHaveText(['Front of House', 'Back of House', 'IT'])
  await area.getByRole('radio', { name: 'IT' }).click()
  await expect(page).toHaveURL(/area=it/)
  for (const name of ['POS & network', 'Website', 'Software']) {
    await expect(page.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: /^Refrigeration/ })).toHaveCount(0)
  // All three fit on a phone, side by side.
  const boxes = await area
    .getByRole('radio')
    .evaluateAll((els) =>
      els.map((e) => ({ fits: e.scrollWidth <= e.clientWidth, top: e.getBoundingClientRect().top })),
    )
  expect(boxes.every((b) => b.fits && b.top === boxes[0].top)).toBe(true)
  await page.waitForTimeout(300)
  await testInfo.attach('create-area-it', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('link', { name: /^POS & network/ }).click()
  await expect(page.getByText('IT › POS & network')).toBeVisible()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Submit ticket' }).click()
  await page.getByRole('button', { name: 'Proceed without photo' }).click()
  const card = page.getByRole('link', { name: new RegExp(title) })
  await expect(card).toContainText('IT · POS & network')
  await card.click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText(/› IT › POS & network/)).toBeVisible()
})
