import { describe, expect, it } from 'vitest'
import { readOpen, today } from './useDashboardOpen'

describe('the dashboard’s open restaurants', () => {
  it('keeps what was opened today', () => {
    expect(readOpen(JSON.stringify({ day: '2026-11-23', ids: ['a', 'b'] }), '2026-11-23')).toEqual(['a', 'b'])
  })

  it('starts closed again on another day', () => {
    expect(readOpen(JSON.stringify({ day: '2026-11-22', ids: ['a'] }), '2026-11-23')).toEqual([])
  })

  it('treats nothing or junk as none open', () => {
    expect(readOpen(null, '2026-11-23')).toEqual([])
    expect(readOpen('not json', '2026-11-23')).toEqual([])
    expect(readOpen(JSON.stringify({ day: '2026-11-23', ids: 'a' }), '2026-11-23')).toEqual([])
    expect(readOpen(JSON.stringify({ day: '2026-11-23', ids: ['a', 3] }), '2026-11-23')).toEqual(['a'])
  })

  it('names the day by the phone’s own date', () => {
    expect(today(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03')
    expect(today(new Date(2026, 10, 4, 0, 1))).toBe('2026-11-04')
  })
})
