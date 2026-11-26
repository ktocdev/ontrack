import { describe, expect, it } from 'vitest'
import { categoryRow, categoryView, hiddenCategories, isOn, isShown, NO_PREFS, switched, toPrefs } from './view'

const ME = 'me'
const POS = 'pos'
const PLUMBING = 'plumbing'

// Theo's start (the IT title): Front and Back of House off and hidden.
const itView = toPrefs(
  [
    { area: 'foh', notify: 'off', shown: false },
    { area: 'boh', notify: 'off', shown: false },
  ],
  [],
)

describe('categoryView', () => {
  it('starts with everything', () => {
    expect(categoryView(NO_PREFS, PLUMBING, 'boh')).toEqual({ notify: 'all', shown: true })
  })

  it('follows the area where the category has nothing of its own', () => {
    expect(categoryView(itView, PLUMBING, 'boh')).toEqual({ notify: 'off', shown: false })
    expect(categoryView(itView, POS, 'it')).toEqual({ notify: 'all', shown: true })
  })

  it('takes the category’s own one setting at a time', () => {
    const prefs = toPrefs(
      [{ area: 'boh', notify: 'off', shown: false }],
      [{ category_id: PLUMBING, notify: 'urgent', shown: null }],
    )
    expect(categoryView(prefs, PLUMBING, 'boh')).toEqual({ notify: 'urgent', shown: false })
  })
})

describe('categoryRow', () => {
  it('leaves empty what matches the area, so it keeps following it', () => {
    expect(categoryRow(itView, 'boh', { notify: 'urgent', shown: false })).toEqual({ notify: 'urgent', shown: null })
    expect(categoryRow(itView, 'boh', { notify: 'off', shown: true })).toEqual({ notify: null, shown: true })
  })

  it('is nothing at all when both match, which deletes the row', () => {
    expect(categoryRow(itView, 'boh', { notify: 'off', shown: false })).toBeNull()
    expect(categoryRow(NO_PREFS, 'foh', { notify: 'all', shown: true })).toBeNull()
  })
})

describe('isShown', () => {
  const ticket = { category_id: PLUMBING, area: 'boh' as const, created_by: 'dana', assignee_id: null }

  it('hides a ticket in a hidden category', () => {
    expect(isShown(itView, ME, ticket)).toBe(false)
    expect(isShown(NO_PREFS, ME, ticket)).toBe(true)
  })

  it('never hides one you filed or are on', () => {
    expect(isShown(itView, ME, { ...ticket, created_by: ME })).toBe(true)
    expect(isShown(itView, ME, { ...ticket, assignee_id: ME })).toBe(true)
  })

  it('shows a hidden area’s category that is shown on its own', () => {
    const prefs = toPrefs(
      [{ area: 'boh', notify: 'off', shown: false }],
      [{ category_id: PLUMBING, notify: null, shown: true }],
    )
    expect(isShown(prefs, ME, ticket)).toBe(true)
  })

  it('goes by area for a task, and shows one with no area', () => {
    expect(isShown(itView, ME, { area: 'foh' })).toBe(false)
    expect(isShown(itView, ME, { area: 'it' })).toBe(true)
    expect(isShown(itView, ME, { area: null })).toBe(true)
  })
})

describe('hiddenCategories', () => {
  const categories = [
    { id: PLUMBING, name: 'Plumbing', area: 'boh' as const, active: true },
    { id: 'bar', name: 'Bar', area: 'foh' as const, active: true },
    { id: 'old', name: 'Old', area: 'foh' as const, active: false },
    { id: POS, name: 'POS & network', area: 'it' as const, active: true },
    { id: 'web', name: 'Website', area: 'it' as const, active: true },
  ]

  it('counts the hidden categories, leaving out turned-off ones, and names an area hidden whole', () => {
    expect(hiddenCategories(itView, categories)).toEqual({
      count: 2,
      names: { areas: ['Front of House', 'Back of House'], categories: [] },
    })
    expect(hiddenCategories(NO_PREFS, categories)).toEqual({ count: 0, names: { areas: [], categories: [] } })
  })

  it('names each category where only some of an area are hidden', () => {
    const prefs = toPrefs([], [{ category_id: POS, notify: null, shown: false }])
    expect(hiddenCategories(prefs, categories)).toEqual({
      count: 1,
      names: { areas: [], categories: ['POS & network'] },
    })
  })

  it('names the categories when an area is hidden but one of its own is shown', () => {
    const prefs = toPrefs(
      [{ area: 'it', notify: 'off', shown: false }],
      [{ category_id: 'web', notify: null, shown: true }],
    )
    expect(hiddenCategories(prefs, categories)).toEqual({
      count: 1,
      names: { areas: [], categories: ['POS & network'] },
    })
  })
})

describe('the row switch', () => {
  it('reads anything shown or notifying as on', () => {
    expect(isOn({ notify: 'off', shown: true }, true)).toBe(true)
    expect(isOn({ notify: 'urgent', shown: false }, true)).toBe(true)
    expect(isOn({ notify: 'off', shown: false }, true)).toBe(false)
    expect(isOn({ notify: 'urgent', shown: false }, false)).toBe(false)
  })

  it('turns everything on or off for the Support Team, and only Show for anyone else', () => {
    expect(switched({ notify: 'urgent', shown: true }, false, true)).toEqual({ notify: 'off', shown: false })
    expect(switched({ notify: 'off', shown: false }, true, true)).toEqual({ notify: 'all', shown: true })
    expect(switched({ notify: 'off', shown: true }, false, false)).toEqual({ notify: 'off', shown: false })
    expect(switched({ notify: 'off', shown: false }, true, false)).toEqual({ notify: 'off', shown: true })
  })
})
