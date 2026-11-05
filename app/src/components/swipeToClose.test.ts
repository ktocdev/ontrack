import { describe, expect, it } from 'vitest'
import { shouldClose } from './swipeToClose'

describe('swipe down to close a sheet', () => {
  it('closes past a third of the sheet, and springs back short of it', () => {
    expect(shouldClose(140, 400, 0)).toBe(true)
    expect(shouldClose(120, 400, 0)).toBe(false)
  })

  it('closes on a quick flick from a short way, but not a twitch', () => {
    expect(shouldClose(40, 600, 0.8)).toBe(true)
    expect(shouldClose(40, 600, 0.3)).toBe(false)
    expect(shouldClose(12, 600, 2)).toBe(false)
  })
})
