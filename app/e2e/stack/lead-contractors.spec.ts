import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Leadership · Contractors, read-only (Exec-Contractors, Exec-Invoices, Exec-Contractor,
 * OT-146) against the seed. Other flows log Coldline visits at Logan Square and edit
 * Hobart, so these look at what stays put: Coldline is in the directory and its Oct 19
 * visit opens leadership's service record, Pipeworks' October visit at Ranalli's has no
 * invoice, and Porter's NS-4410 is on the Invoices tab. It only reads.
 */

test.use({ timezoneId: 'America/Chicago' })

const LEE = 'lee.chen@example.com'
const COLDLINE = '55555555-5555-4555-8555-000000000001'

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  await page.waitForTimeout(300)
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

test('leadership reads the directory and a contractor, and can change neither', async ({ page }, testInfo) => {
  await signIn(page, LEE)
  await page.getByRole('navigation', { name: 'Leadership' }).getByRole('link', { name: 'Contractors' }).click()
  await expect(page).toHaveURL(/\/lead\/contractors$/)
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Contractors', level: 1 })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Contractors' }).getByRole('link', { name: 'Invoices' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^All · \d+$/ })).toBeVisible()
  await expect(page.getByText(/^Spend · \d{4}$/)).toBeVisible()
  // Nothing adds, picks a restaurant or looks after trades.
  await expect(page.getByRole('link', { name: 'Add contractor' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /All restaurants/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More options for contractors' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Call Coldline Refrigeration' })).toHaveAttribute('href', /^tel:/)
  await shot(page, testInfo, 'directory')

  await page.getByRole('searchbox', { name: 'Search contractors' }).fill('coldline')
  await page
    .getByRole('link', { name: /^Coldline Refrigeration/ })
    .first()
    .click()
  await expect(page).toHaveURL(new RegExp(`/lead/contractors/${COLDLINE}$`))
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Coldline Refrigeration', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Call Coldline Refrigeration' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Email Coldline Refrigeration' })).toHaveAttribute('href', /^mailto:/)
  await expect(page.getByText('Rosa Alvarez')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /More options|Share/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Log service' })).toHaveCount(0)
  await shot(page, testInfo, 'contractor')

  // The Oct 19 visit opens leadership's service record, and Back comes back here.
  await page.getByRole('link', { name: /Oct 19, 2026.*Condenser fan motor replaced/ }).click()
  await expect(page).toHaveURL(/\/lead\/service\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Condenser fan motor replaced' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  await page.getByRole('link', { name: /^Back/ }).click()
  await expect(page).toHaveURL(new RegExp(`/lead/contractors/${COLDLINE}$`))

  // The Invoices tab names what is in.
  await page
    .getByRole('navigation', { name: 'Contractor history' })
    .getByRole('link', { name: /Invoices/ })
    .click()
  await expect(page).toHaveURL(new RegExp(`/lead/contractors/${COLDLINE}/invoices$`))
  await expect(page.getByText('INV-58213', { exact: true })).toBeVisible()
})

test('a missing invoice says Ops hasn’t attached it, with nothing to attach it with', async ({ page }) => {
  await signIn(page, LEE)
  await page.goto('/lead/contractors')
  await page.getByRole('searchbox', { name: 'Search contractors' }).fill('pipeworks')
  await page
    .getByRole('link', { name: /^Pipeworks Plumbing/ })
    .first()
    .click()
  await page
    .getByRole('navigation', { name: 'Contractor history' })
    .getByRole('link', { name: /Invoices/ })
    .click()
  await expect(page.getByText(/hasn't attached (it|them) yet\./)).toBeVisible()
  await expect(page.getByText('Open the visit to attach it.')).toHaveCount(0)
})

test('the Invoices tab lists every restaurant’s visits, each opening its record', async ({ page }, testInfo) => {
  await signIn(page, LEE)
  await page.goto('/lead/contractors')
  await page.getByRole('navigation', { name: 'Contractors' }).getByRole('link', { name: 'Invoices' }).click()
  await expect(page).toHaveURL(/\/lead\/contractors\/invoices$/)
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await expect(page.getByRole('button', { name: /All restaurants/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Missing · \d+$/ })).toBeVisible()
  await shot(page, testInfo, 'invoices')

  await page.getByRole('button', { name: /^Month: / }).click()
  await page.getByRole('menuitemradio', { name: 'All months' }).click()
  await page.getByRole('searchbox', { name: 'Search invoices' }).fill('ns-4410')
  const row = page.getByRole('link', { name: /Northstar HVAC/ })
  await expect(row).toHaveCount(1)
  await row.click()
  await expect(page).toHaveURL(/\/lead\/service\/[0-9a-f-]{36}$/)
  await expect(page.getByText('READ-ONLY VIEW')).toBeVisible()
  await page.getByRole('link', { name: /^Back/ }).click()
  await expect(page).toHaveURL(/\/lead\/contractors\/invoices$/)
})

test('a contractor’s lasting link opens leadership’s contractor page', async ({ page }) => {
  await signIn(page, LEE)
  await page.goto(`/c/${COLDLINE}`)
  await expect(page).toHaveURL(new RegExp(`/lead/contractors/${COLDLINE}$`))
  await expect(page.getByRole('heading', { name: 'Coldline Refrigeration', level: 1 })).toBeVisible()
})
