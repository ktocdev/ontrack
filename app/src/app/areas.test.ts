import { describe, expect, it } from 'vitest'
import { ticketArea, ticketPlace } from './areas'

describe('where a ticket belongs', () => {
  const withCategory = { category: { name: 'Plumbing', area: 'foh' as const }, area: null, checklist_place: null }
  const fromChecklist = { category: null, area: 'boh' as const, checklist_place: 'BOH › Envelope › Walls' }

  it('takes the area from the category', () => {
    expect(ticketArea(withCategory)).toBe('foh')
    expect(ticketPlace(withCategory)).toEqual(['FOH', 'Plumbing'])
    expect(ticketPlace(withCategory, 'long')).toEqual(['Front of House', 'Plumbing'])
  })

  it('reads a walkthrough ticket with no category as its place on the checklist', () => {
    expect(ticketArea(fromChecklist)).toBe('boh')
    expect(ticketPlace(fromChecklist)).toEqual(['BOH › Envelope › Walls'])
  })

  it('keeps the category when a ticket has both', () => {
    expect(ticketPlace({ ...withCategory, checklist_place: 'BOH › Electrical › Outlets' })).toEqual(['FOH', 'Plumbing'])
  })

  it('falls back to the area alone, or nothing', () => {
    expect(ticketPlace({ category: null, area: 'it', checklist_place: null })).toEqual(['IT'])
    expect(ticketPlace({})).toEqual([])
    expect(ticketArea({})).toBeNull()
  })
})
