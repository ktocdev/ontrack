import { describe, expect, it } from 'vitest'
import {
  checklistTitle,
  dueDate,
  monthName,
  monthShort,
  pastFlag,
  progressOf,
  quarterEnd,
  quarterOf,
  splitByRestaurant,
  type ProgressRow,
} from './walkthrough'

const row = (over: Partial<ProgressRow>): ProgressRow => ({
  walkthrough_id: 'w',
  kind: 'section',
  section_id: null,
  name: null,
  short_name: null,
  sort_order: 0,
  total: 0,
  done: 0,
  tickets: 0,
  fixes: 0,
  good_items: 0,
  inhouse_items: 0,
  ticket_items: 0,
  ...over,
})

// The board: 20 of 50, Back of House 16 of 24 with 2 tickets and 1 in-house.
const BOARD = [
  row({ kind: 'quarterly', sort_order: 1000, total: 2 }),
  row({
    section_id: 'foh',
    name: 'Front of House',
    short_name: 'FOH',
    sort_order: 2,
    total: 24,
    done: 4,
    good_items: 4,
  }),
  row({
    section_id: 'boh',
    name: 'Back of House',
    short_name: 'BOH',
    sort_order: 1,
    total: 24,
    done: 16,
    tickets: 2,
    fixes: 1,
    good_items: 12,
    inhouse_items: 2,
    ticket_items: 2,
  }),
]

describe('progressOf', () => {
  it('orders the sections and puts the quarter last, named for its quarter', () => {
    const p = progressOf(BOARD, '2026-10-01')
    expect(p.parts.map((x) => x.name)).toEqual(['Back of House', 'Front of House', 'Q4 location tasks'])
    expect(p.parts[2]!.key).toBe('quarterly')
  })

  it('adds up the whole walkthrough', () => {
    const p = progressOf(BOARD, '2026-10-01')
    expect([p.done, p.total]).toEqual([20, 50])
    expect([p.good, p.inhouse, p.ticketItems]).toEqual([16, 2, 2])
    expect([p.tickets, p.fixes]).toEqual([2, 1])
  })

  it('reads nothing as zero', () => {
    expect(progressOf([], '2026-10-01')).toMatchObject({ total: 0, done: 0, parts: [] })
  })
})

describe('checklistTitle', () => {
  it('joins the sections, leaving out the quarter', () => {
    const { parts } = progressOf(BOARD, '2026-10-01')
    expect(checklistTitle(parts)).toBe('Back of House + Front of House')
    expect(checklistTitle(parts, true)).toBe('BOH + FOH')
  })
})

describe('dates', () => {
  it('reads a day as that day wherever the phone is', () => {
    expect(monthName('2026-10-01')).toBe('October')
    expect(monthShort('2026-09-01')).toBe('Sep')
    expect(dueDate('2026-10-31')).toBe('Sat, Oct 31')
  })

  it('gives the quarter its last day', () => {
    expect(['2026-10-01', '2026-11-01', '2026-02-01', '2026-06-01', '2026-09-01'].map(quarterEnd)).toEqual([
      'Dec 31',
      'Dec 31',
      'Mar 31',
      'Jun 30',
      'Sep 30',
    ])
  })

  it('names the quarter', () => {
    expect(['2026-01-01', '2026-03-01', '2026-04-01', '2026-12-01'].map(quarterOf)).toEqual(['Q1', 'Q1', 'Q2', 'Q4'])
  })
})

describe('pastFlag', () => {
  it('says what a submitted month flagged, tickets first', () => {
    expect(pastFlag('submitted', { tickets: 5, fixes: 2 })).toEqual({ tone: 'ticket', label: '5 tickets' })
    expect(pastFlag('submitted', { tickets: 1, fixes: 0 })).toEqual({ tone: 'ticket', label: '1 ticket' })
    expect(pastFlag('submitted', { tickets: 0, fixes: 2 })).toEqual({ tone: 'inhouse', label: '2 in-house' })
    expect(pastFlag('submitted', { tickets: 0, fixes: 0 })).toEqual({ tone: 'good', label: 'All good' })
  })

  it('says Not done for one never submitted', () => {
    expect(pastFlag('open', { tickets: 3, fixes: 0 })).toEqual({ tone: 'missed', label: 'Not done' })
  })
})

describe('splitByRestaurant', () => {
  const w = (id: string, restaurant_id: string, period: string) => ({ id, restaurant_id, period })
  it('shows each restaurant its newest and lists the rest as past, newest first', () => {
    const { current, past } = splitByRestaurant(
      [
        w('sep-a', 'a', '2026-09-01'),
        w('oct-a', 'a', '2026-10-01'),
        w('oct-b', 'b', '2026-10-01'),
        w('aug-a', 'a', '2026-08-01'),
      ],
      ['a', 'b', 'c'],
    )
    expect(current.map((x) => x.id)).toEqual(['oct-a', 'oct-b'])
    expect(past.map((x) => x.id)).toEqual(['sep-a', 'aug-a'])
  })
})
