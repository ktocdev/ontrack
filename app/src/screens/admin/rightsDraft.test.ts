import { describe, expect, it } from 'vitest'
import { changedCells, countPeople, countRights, overrideFor } from './rightsDraft'

describe('changedCells', () => {
  const cells = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const saved = (c: { id: string }) => c.id === 'a'

  it('finds only what differs from what is saved', () => {
    const draft = new Map([
      ['a', true],
      ['b', true],
    ])
    expect(changedCells(cells, saved, draft)).toEqual([{ cell: { id: 'b' }, allowed: true }])
  })

  it('is empty when a cell was changed and changed back', () => {
    expect(changedCells(cells, saved, new Map([['a', true]]))).toEqual([])
  })
})

describe('overrideFor', () => {
  it('stores nothing when the switch matches the role default', () => {
    expect(overrideFor(true, true)).toBeNull()
    expect(overrideFor(false, false)).toBeNull()
  })

  it('stores the value when it differs', () => {
    expect(overrideFor(true, false)).toBe(true)
    expect(overrideFor(false, true)).toBe(false)
  })
})

describe('counts', () => {
  it('reads as the boards do', () => {
    expect(countRights(1)).toBe('1 right')
    expect(countRights(2)).toBe('2 rights')
    expect(countPeople(1)).toBe('1 person')
    expect(countPeople(3)).toBe('3 people')
  })
})
