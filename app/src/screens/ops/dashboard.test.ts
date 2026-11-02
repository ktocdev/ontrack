import { describe, expect, it } from 'vitest'
import { byPriority, groupByRestaurant, inChosenOrder } from './dashboard'

describe('byPriority', () => {
  const ticket = (id: string, urgency: string, area: string | null, created_at: string) => ({
    id,
    urgency,
    created_at,
    category: area ? { area } : null,
  })

  it('puts urgent on top, then Front before Back, then the oldest', () => {
    const list = [
      ticket('back-new', 'normal', 'boh', '2026-10-05T10:00:00Z'),
      ticket('front-new', 'normal', 'foh', '2026-10-04T10:00:00Z'),
      ticket('back-old', 'normal', 'boh', '2026-10-01T10:00:00Z'),
      ticket('urgent-back', 'urgent', 'boh', '2026-10-06T10:00:00Z'),
      ticket('front-old', 'normal', 'foh', '2026-10-02T10:00:00Z'),
      ticket('urgent-front', 'urgent', 'foh', '2026-10-07T10:00:00Z'),
    ]
    expect([...list].sort(byPriority).map((t) => t.id)).toEqual([
      'urgent-front',
      'urgent-back',
      'front-old',
      'front-new',
      'back-old',
      'back-new',
    ])
  })

  it('counts a ticket with no category after Front', () => {
    const list = [
      ticket('none', 'normal', null, '2026-10-01T10:00:00Z'),
      ticket('front', 'normal', 'foh', '2026-10-02T10:00:00Z'),
    ]
    expect([...list].sort(byPriority).map((t) => t.id)).toEqual(['front', 'none'])
  })
})

describe('groupByRestaurant', () => {
  const restaurants = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const tickets = [
    { id: '1', restaurant_id: 'c' },
    { id: '2', restaurant_id: 'a' },
    { id: '3', restaurant_id: 'c' },
  ]

  it('follows the restaurants’ order, keeps each list’s order, and leaves out the empty', () => {
    expect(groupByRestaurant(tickets, restaurants).map((g) => [g.restaurant.id, g.tickets.map((t) => t.id)])).toEqual([
      ['a', ['2']],
      ['c', ['1', '3']],
    ])
  })

  it('leaves out a restaurant that isn’t in the list', () => {
    expect(groupByRestaurant(tickets, [{ id: 'a' }]).map((g) => g.restaurant.id)).toEqual(['a'])
  })
})

describe('inChosenOrder', () => {
  const restaurants = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const ids = (chosen: string[]) => inChosenOrder(restaurants, chosen).map((r) => r.id)

  it('keeps the group’s order with nothing chosen', () => {
    expect(ids([])).toEqual(['a', 'b', 'c'])
  })

  it('follows what was chosen', () => {
    expect(ids(['c', 'a', 'b'])).toEqual(['c', 'a', 'b'])
  })

  it('puts a restaurant added since after the rest, and drops one that is gone', () => {
    expect(ids(['c', 'gone', 'a'])).toEqual(['c', 'a', 'b'])
  })
})
