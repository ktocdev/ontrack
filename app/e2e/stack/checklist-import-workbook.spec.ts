import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Ops · Import checklist from a workbook (OT-138). The other import flow uploads CSVs, which
 * the app reads itself; an .xlsx goes through read-excel-file, which unzips a large one in a
 * web worker made from a blob. Playwright's server sends no content security policy, so this
 * test puts the one the build writes for Cloudflare (dist/_headers) on every page and reads
 * a small workbook and a large one under it. Before the policy allowed blob workers, the
 * large one never finished reading. It imports nothing, so it runs with the others. The
 * workbooks come from fixtures/make-workbooks.mjs.
 */

// A page Playwright answers itself counts as outside the local network, and Chromium then
// refuses its calls to the local stack; that check is not what this test is about.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } })

const BERT = 'bert.velilla@example.com'
const BOH_FOH = '88888888-8888-4888-8888-000000000001'
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

async function withAppPolicy(page: Page) {
  const headers = await readFile('dist/_headers', 'utf8')
  const policy = /^\s*Content-Security-Policy:\s*(.+)$/m.exec(headers)?.[1]?.trim()
  expect(policy, 'the build wrote a content security policy').toBeTruthy()
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback()
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy! } })
  })
}

test('a workbook, small or large, is read under the content security policy the deployed app sends', async ({
  page,
}) => {
  await withAppPolicy(page)
  const refused: string[] = []
  page.on('console', (m) => {
    if (/content security policy/i.test(m.text())) refused.push(m.text())
  })

  await signIn(page, BERT)
  await page.goto(`/ops/walkthroughs/checklists/${BOH_FOH}/import`)
  await expect(page.getByRole('heading', { name: 'Import from a spreadsheet' })).toBeVisible()

  await page.getByLabel('Spreadsheet to import').setInputFiles(fixture('checklist.xlsx'))
  await expect(page.getByText('What will change')).toBeVisible()
  await page.getByText('Added', { exact: true }).click()
  await expect(page.getByText('Workbook section › Workbook group › Read from a workbook')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replace checklist with 2 items' })).toBeVisible()

  // Its sheet is over 512 KB unzipped, which the reader unzips in a worker.
  await page.getByLabel('Spreadsheet to import').setInputFiles(fixture('checklist-large.xlsx'))
  await expect(page.getByRole('button', { name: 'Replace checklist with 902 items' })).toBeVisible()

  expect(refused, 'nothing the page did was refused by the policy').toEqual([])
})
