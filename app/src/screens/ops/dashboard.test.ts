import { describe, expect, it } from 'vitest'
import { byAttention, groupByRestaurant } from './dashboard'

describe('byAttention', () => {
  it('puts reopened first, then urgent, then the most recent activity', () => {
    const list = [
      { id: 'old-normal', status: 'open', urgency: 'normal', activity: '2026-10-01T10:00:00Z' },
      { id: 'old-urgent', status: 'open', urgency: 'urgent', activity: '2026-10-01T10:00:00Z' },
      { id: 'new-normal', status: 'open', urgency: 'normal', activity: '2026-10-02T10:00:00Z' },
      { id: 'new-urgent', status: 'open', urgency: 'urgent', activity: '2026-10-02T10:00:00Z' },
      { id: 'reopened', status: 'reopened', urgency: 'normal', activity: '2026-09-01T10:00:00Z' },
    ]
    expect([...list].sort(byAttention).map((t) => t.id)).toEqual([
      'reopened',
      'new-urgent',
      'old-urgent',
      'new-normal',
      'old-normal',
    ])
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
