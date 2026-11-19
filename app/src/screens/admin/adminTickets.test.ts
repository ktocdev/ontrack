import { describe, expect, it } from 'vitest'
import { matchesTicket } from './adminTickets'

const t = {
  title: 'Walk-in cooler not holding temp',
  display_id: 'OT-1042',
  checklist_place: null,
  category: { name: 'Refrigeration' },
  equipment: { name: 'Walk-in Cooler 1' },
}

describe('admin ticket search', () => {
  it('finds a title, unit or category, ignoring case', () => {
    expect(matchesTicket(t, '')).toBe(true)
    expect(matchesTicket(t, 'COOLER')).toBe(true)
    expect(matchesTicket(t, 'walk-in cooler 1')).toBe(true)
    expect(matchesTicket(t, 'refrig')).toBe(true)
    expect(matchesTicket(t, 'dish')).toBe(false)
  })

  it('finds a number however it is typed', () => {
    expect(matchesTicket(t, 'OT-1042')).toBe(true)
    expect(matchesTicket(t, 'ot1042')).toBe(true)
    expect(matchesTicket(t, '1042')).toBe(true)
    expect(matchesTicket(t, '1043')).toBe(false)
  })

  it('finds a walkthrough ticket by its place on the checklist', () => {
    const w = { ...t, category: null, equipment: null, checklist_place: 'FOH › Health and Safety › Caulk' }
    expect(matchesTicket(w, 'caulk')).toBe(true)
  })
})
