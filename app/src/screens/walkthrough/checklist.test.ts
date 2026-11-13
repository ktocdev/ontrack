import { describe, expect, it } from 'vitest'
import { firstOpen, groupsOf, openAfter, type CheckRow, type FixRow, type ItemRow, type TicketRow } from './checklist'

const item = (id: string, group_name: string, sort_order: number, over: Partial<ItemRow> = {}): ItemRow => ({
  id,
  section_id: 'boh',
  group_name,
  title: id,
  sort_order,
  active: true,
  ...over,
})
const ITEMS = [
  item('outlets', 'Electrical', 2),
  item('bulbs', 'Electrical', 1),
  item('drains', 'Plumbing', 3),
  item('walls', 'Envelope', 4),
  item('hosts', 'Front', 1, { section_id: 'foh' }),
]
const fix = (id: string, check_id: string, done_at: string | null = null): FixRow => ({
  id,
  check_id,
  title: id,
  done_at,
  created_at: `2026-10-0${id.length}`,
})
const ticket = (id: string, check_id: string, status = 'open'): TicketRow => ({
  id,
  display_id: `OT-${id}`,
  title: id,
  urgency: 'normal',
  status,
  walkthrough_check_id: check_id,
  created_at: '2026-10-05',
})

describe('groupsOf', () => {
  it('keeps the section’s items in their groups, in checklist order', () => {
    const groups = groupsOf('boh', ITEMS, [], [], [])
    expect(groups.map((g) => [g.name, g.items.map((i) => i.id)])).toEqual([
      ['Electrical', ['bulbs', 'outlets']],
      ['Plumbing', ['drains']],
      ['Envelope', ['walls']],
    ])
    expect(groups[0]).toMatchObject({ done: 0, total: 2 })
  })

  it('counts an item done when Good or when it has a fix or a ticket', () => {
    const checks: CheckRow[] = [
      { id: 'c1', item_id: 'bulbs', result: 'good' },
      { id: 'c2', item_id: 'outlets', result: 'ticket' },
    ]
    const [electrical] = groupsOf('boh', ITEMS, checks, [fix('f', 'c2')], [ticket('1051', 'c2')])
    expect(electrical).toMatchObject({ done: 2, total: 2 })
    expect(electrical!.items[1]).toMatchObject({ good: false, open: true, done: true })
    expect(electrical!.items[1]!.fixes.map((f) => f.id)).toEqual(['f'])
  })

  it('lets Good back once every fix is checked off and every ticket closed', () => {
    const checks: CheckRow[] = [{ id: 'c2', item_id: 'outlets', result: 'in_house' }]
    const [electrical] = groupsOf('boh', ITEMS, checks, [fix('f', 'c2', '2026-10-09')], [ticket('1', 'c2', 'closed')])
    expect(electrical!.items[1]!.open).toBe(false)
  })

  it('keeps an item turned off only if it was checked', () => {
    const items = [
      ...ITEMS,
      item('gone', 'Envelope', 5, { active: false }),
      item('kept', 'Envelope', 6, { active: false }),
    ]
    const groups = groupsOf('boh', items, [{ id: 'c', item_id: 'kept', result: 'good' }], [], [])
    expect(groups[2]!.items.map((i) => i.id)).toEqual(['walls', 'kept'])
  })
})

describe('which groups are open', () => {
  const none = groupsOf('boh', ITEMS, [], [], [])
  const electricalDone = groupsOf(
    'boh',
    ITEMS,
    [
      { id: 'a', item_id: 'bulbs', result: 'good' },
      { id: 'b', item_id: 'outlets', result: 'good' },
    ],
    [],
    [],
  )

  it('opens the first group with something to do', () => {
    expect([...firstOpen(none)]).toEqual(['Electrical'])
    expect([...firstOpen(electricalDone)]).toEqual(['Plumbing'])
  })

  it('closes a group as it fills and opens the next', () => {
    expect([...openAfter(none, electricalDone, new Set(['Electrical']))]).toEqual(['Plumbing'])
  })

  it('leaves what was opened by hand when nothing filled', () => {
    const open = new Set(['Electrical', 'Envelope'])
    expect(openAfter(none, none, open)).toBe(open)
  })
})
