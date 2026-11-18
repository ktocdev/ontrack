import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { signIn } from '../helpers'

/**
 * Ops · Import checklist (OT-137) against the seed's Back of House + Front of House, month B
 * of the group's rotation, which past walkthroughs have had. In `last/`, after 6a's done
 * test, since importing makes a new version the rotation moves to. The test imports a
 * changed sheet, then the template it downloaded, which puts the checklist back as it was.
 */

test.use({ timezoneId: 'America/Chicago' })

const BERT = 'bert.velilla@example.com'

const shot = async (page: Page, testInfo: TestInfo, name: string) =>
  testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })

/** A CSV line split into cells, for the simple rows the template writes (no quotes needed). */
const cells = (line: string) => line.split(',')

test('Ops downloads the template, imports a changed sheet, and imports the template back', async ({
  page,
}, testInfo) => {
  const added = `Import test · grease trap ${testInfo.project.name} ${Date.now() % 100000}`
  await signIn(page, BERT)
  await page.goto('/ops/walkthroughs/schedule')
  await page.getByRole('button', { name: 'Edit month B' }).click()
  await page.getByRole('dialog', { name: 'Month B' }).getByRole('button', { name: 'Edit this checklist' }).click()
  await expect(page.getByRole('heading', { name: 'Back of House + Front of House' })).toBeVisible()
  await page.getByRole('link', { name: 'Import from a spreadsheet' }).click()
  await expect(page.getByRole('heading', { name: 'Import from a spreadsheet' })).toBeVisible()

  // The template is the checklist as it is.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download template' }).click()
  const template = await readFile((await (await download).path())!, 'utf8')
  const lines = template.replace(/^﻿/, '').trim().split(/\r\n/)
  expect(cells(lines[0]!)).toEqual([
    'Section',
    'Section short name',
    'Area',
    'Group',
    'Item',
    'Directions',
    'How-to video link',
    'Category',
  ])
  const original = testInfo.outputPath('template.csv')
  await writeFile(original, template)

  // A sheet without a column is refused, with what is wrong.
  const broken = testInfo.outputPath('broken.csv')
  await writeFile(broken, 'Section,Item\nKitchen,Outlets\n')
  await page.getByLabel('Spreadsheet to import').setInputFiles(broken)
  await expect(page.getByText('The sheet has no Group column. Start from the template.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Replace checklist/ })).toHaveCount(0)

  // Change one item's directions, add one, and leave the last one out.
  const rows = lines.slice(1).filter((l) => !l.includes('"'))
  const first = cells(rows[0]!)
  first[5] = 'Changed by the import test'
  const last = cells(rows[rows.length - 1]!)
  const changed = [
    lines[0],
    first.join(','),
    ...rows.slice(1, -1),
    [first[0], first[1], first[2], first[3], added].join(','),
  ]
  const sheet = testInfo.outputPath('changed.csv')
  await writeFile(sheet, changed.join('\r\n') + '\r\n')
  await page.getByLabel('Spreadsheet to import').setInputFiles(sheet)
  await expect(page.getByText('What will change')).toBeVisible()
  // Only the one item changed: the template reads back as it was written.
  await expect(page.getByText('Changed', { exact: true }).locator('..')).toContainText('1')
  await page.getByText('Added', { exact: true }).click()
  await expect(page.getByText(new RegExp(`${first[0]} › ${first[3]} › ${added}`))).toBeVisible()
  await page.getByText('Taken off', { exact: true }).click()
  await expect(page.getByText(`${last[0]} › ${last[3]} › ${last[4]} (turned off, kept on the record)`)).toBeVisible()
  // A new version if a walkthrough has had this one; the other browser's run may have made one already.
  await expect(
    page.getByText(/(keep it as it was\. The import makes a new version|the import replaces it)/),
  ).toBeVisible()
  await shot(page, testInfo, 'import · preview')
  await page.getByRole('button', { name: /^Replace checklist with \d+ items$/ }).click()

  // Back on the editor: a new version, with the added item.
  await expect(page).toHaveURL(/\/ops\/walkthroughs\/checklists\/[0-9a-f-]{36}$/)
  await expect(page.getByText(added)).toBeVisible()
  await expect(page.getByText(/^No walkthrough has had this version yet\./)).toBeVisible()

  // Importing the template puts it back as it was.
  await page.getByRole('link', { name: 'Import from a spreadsheet' }).click()
  await page.getByLabel('Spreadsheet to import').setInputFiles(original)
  await expect(page.getByText('What will change')).toBeVisible()
  await page.getByRole('button', { name: /^Replace checklist with \d+ items$/ }).click()
  await expect(page.getByRole('heading', { name: 'Back of House + Front of House' })).toBeVisible()
  await expect(page.getByText(added)).toHaveCount(0)
})
