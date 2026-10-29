import { expect, type Page } from '@playwright/test'

/** Every seeded person signs in with this (supabase/seed.sql). */
export const SEED_PASSWORD = 'ontrack-demo-2026'

/** Sign in through the real form and wait for the role's home screen. */
export async function signIn(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto('/sign-in')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible()
}

export async function openProfile(page: Page, email: string) {
  await signIn(page, email)
  await page.getByRole('link', { name: 'Your profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
}
