import { describe, expect, it } from 'vitest'
import { categoryRow, categoryView, hiddenCount, isOn, isShown, NO_PREFS, switched, toPrefs } from './view'

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

describe('hiddenCount', () => {
  const categories = [
    { id: PLUMBING, area: 'boh' as const, active: true },
    { id: 'bar', area: 'foh' as const, active: true },
    { id: 'old', area: 'foh' as const, active: false },
    { id: POS, area: 'it' as const, active: true },
  ]

  it('counts the categories that are hidden, leaving out turned-off ones', () => {
    expect(hiddenCount(itView, categories)).toBe(2)
    expect(hiddenCount(NO_PREFS, categories)).toBe(0)
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
