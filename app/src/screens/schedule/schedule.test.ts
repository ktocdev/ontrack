import { describe, expect, it } from 'vitest'
import { checklistSize, dueLabel, letterOf, listNames, positionFor, remindersLabel, toneOf } from './schedule'

describe('a rotation’s months', () => {
  it('counts from the start, round the cycle, as the board’s A / B year does', () => {
    const year = Array.from({ length: 12 }, (_, m) => letterOf(positionFor('2026-01-01', 2, 2026, m)!))
    expect(year.join('')).toBe('ABABABABABAB')
  })
  it('follows the cycle back before the start, and into later years', () => {
    expect(positionFor('2026-01-01', 3, 2025, 11)).toBe(2)
    expect(positionFor('2026-01-01', 3, 2027, 0)).toBe(0)
    expect(positionFor('2026-03-01', 2, 2026, 2)).toBe(0)
  })
  it('has no month for an empty cycle', () => {
    expect(positionFor('2026-01-01', 0, 2026, 0)).toBeNull()
  })
  it('takes three tones, then goes round', () => {
    expect([0, 1, 2, 3].map(toneOf)).toEqual([1, 2, 3, 1])
  })
})

describe('how the settings read', () => {
  it('lists names as a sentence', () => {
    expect(listNames(['Logan Square', 'Porter', 'West Loop'])).toBe('Logan Square, Porter and West Loop')
    expect(listNames(['Porter'])).toBe('Porter')
    expect(listNames([])).toBe('no restaurants yet')
  })
  it('says the due day', () => {
    expect(dueLabel(null)).toBe('Last day of the month')
    expect(dueLabel(1)).toBe('The 1st')
    expect(dueLabel(12)).toBe('The 12th')
    expect(dueLabel(22)).toBe('The 22nd')
    expect(dueLabel(25)).toBe('The 25th')
  })
  it('says the reminders as the board does', () => {
    expect(remindersLabel([2, 7])).toBe('7 and 2 days before')
    expect(remindersLabel([1])).toBe('1 day before')
    expect(remindersLabel([1, 0])).toBe('1 day before and on the day')
    expect(remindersLabel([0])).toBe('On the day')
    expect(remindersLabel([])).toBe('None')
  })
  it('sizes a checklist', () => {
    expect(checklistSize(7, 24)).toBe('7 zones · 24 items')
    expect(checklistSize(1, 1)).toBe('1 zone · 1 item')
  })
})
