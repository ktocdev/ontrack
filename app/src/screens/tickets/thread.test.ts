import { describe, expect, it } from 'vitest'
import { assigneeIds, threadItems, type Update } from './thread'

const MAYA = { id: 'maya', full_name: 'Maya Reyes', role: 'manager' as const, avatar_path: null }
const BERT = { id: 'bert', full_name: 'Bert Velilla', role: 'ops' as const, avatar_path: 'bert/a.jpg' }
const names = new Map([['bert', 'Bert Velilla']])
const now = new Date('2026-10-19T12:00:00')

const update = (
  id: string,
  kind: Update['kind'],
  at: string,
  author: Update['author'],
  rest: Partial<Update> = {},
): Update => ({
  id,
  kind,
  created_at: `2026-10-19T${at}:00`,
  author,
  body: null,
  meta: {},
  ...rest,
})

describe('the ticket thread', () => {
  it('reads as the board does: the date once, and an assignment with its status on one line', () => {
    const items = threadItems(
      [
        update('1', 'created', '09:12', MAYA),
        update('2', 'assigned', '09:40', BERT, { meta: { to: 'bert' } }),
        update('3', 'status_changed', '09:40', BERT, { meta: { from: 'open', to: 'in_progress' } }),
        update('4', 'message', '11:00', BERT, { body: 'Tech booked.' }),
        update('5', 'message', '11:15', MAYA, { body: 'Thanks.' }),
      ],
      'maya',
      names,
      now,
    )
    expect(items.map((i) => (i.type === 'event' ? [i.text, i.when] : [i.who, i.when, i.mine]))).toEqual([
      ['Opened by you', 'Oct 19, 2026, 9:12 AM'],
      ['Bert Velilla took this · status In progress', '9:40 AM'],
      ['Bert Velilla, Ops', '1h ago', false],
      ['You', '45m ago', true],
    ])
  })

  it('names who did it when it was not you', () => {
    const [opened] = threadItems([update('1', 'created', '09:12', BERT)], 'maya', names, now)
    expect(opened).toMatchObject({ text: 'Opened by Bert Velilla' })
  })

  it('keeps a status change and an assignment apart when they are not together', () => {
    const items = threadItems(
      [
        update('1', 'status_changed', '09:00', BERT, { meta: { to: 'waiting_parts' } }),
        update('2', 'assigned', '10:00', BERT, { meta: { to: null } }),
      ],
      'maya',
      names,
      now,
    )
    expect(items.map((i) => i.type === 'event' && i.text)).toEqual(['Status Waiting on parts', 'Nobody on this now'])
  })

  it('shows what a person wrote with an event as their message', () => {
    const items = threadItems(
      [
        update('1', 'status_changed', '09:00', BERT, { meta: { to: 'in_progress' }, body: 'Gasket ordered.' }),
        update('2', 'reopened', '09:30', MAYA, { meta: { to: 'reopened' }, body: 'Frost again.' }),
      ],
      'maya',
      names,
      now,
    )
    expect(items.map((i) => (i.type === 'event' ? i.text : i.text))).toEqual([
      'Status In progress',
      'Gasket ordered.',
      'Reopened by you',
      'Frost again.',
    ])
  })

  it('stands up to someone whose account is gone', () => {
    const items = threadItems([update('1', 'message', '11:59', null, { body: 'Hello' })], 'maya', names, now)
    expect(items[0]).toMatchObject({ who: 'Someone', when: '1m ago', mine: false })
  })

  it('lists who it needs names for, once each', () => {
    expect(
      assigneeIds([
        { kind: 'assigned', meta: { to: 'bert' } },
        { kind: 'assigned', meta: { to: 'bert' } },
        { kind: 'assigned', meta: { to: null } },
        { kind: 'message', meta: {} },
      ]),
    ).toEqual(['bert'])
  })
})
