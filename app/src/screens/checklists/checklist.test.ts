import { describe, expect, it } from 'vitest'
import { groupsOf, idsByGroups, itemLine } from './checklist'

const items = [
  { id: 'c', group_name: 'Plumbing', sort_order: 3 },
  { id: 'a', group_name: 'Electrical', sort_order: 1 },
  { id: 'b', group_name: 'Electrical', sort_order: 2 },
  { id: 'd', group_name: 'Electrical', sort_order: 4 },
]

describe('a section’s groups', () => {
  it('follow the order of their first item, each with its items in order', () => {
    expect(groupsOf(items).map((g) => `${g.name}:${g.items.map((i) => i.id).join('')}`)).toEqual([
      'Electrical:abd',
      'Plumbing:c',
    ])
  })
  it('put in a new order, give every item’s id group by group', () => {
    expect(idsByGroups(items, ['Plumbing', 'Electrical'])).toEqual(['c', 'a', 'b', 'd'])
  })
})

describe('an item’s line', () => {
  it('says its category, and whether it has directions and a video', () => {
    expect(itemLine({ directions: 'x', video_url: 'https://a' }, 'Electrical')).toBe('Electrical · directions · video')
    expect(itemLine({ directions: null, video_url: null }, null)).toBe('No category')
  })
})
