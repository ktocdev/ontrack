import { describe, expect, it } from 'vitest'
import { safeReturnPath } from './returnPath'

describe('safeReturnPath', () => {
  it('keeps a page of this app, with its query', () => {
    expect(safeReturnPath('/t/OT-1042')).toBe('/t/OT-1042')
    expect(safeReturnPath('/profile?tab=help')).toBe('/profile?tab=help')
    expect(safeReturnPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com')
  })

  it('refuses anything a browser would read as another site', () => {
    for (const path of ['//evil.com/x', '/\\evil.com', '//', 'https://evil.com', 'evil.com', '', undefined, null]) {
      expect(safeReturnPath(path)).toBeNull()
    }
  })
})
