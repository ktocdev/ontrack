import { afterEach, describe, expect, it, vi } from 'vitest'
import { equipmentLink, shareLink, ticketLink, ticketNumber } from './share'

function device({ coarse, share }: { coarse: boolean; share?: () => Promise<void> }) {
  vi.stubGlobal('matchMedia', () => ({ matches: coarse }))
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  Object.defineProperty(navigator, 'share', { configurable: true, value: share })
  return { writeText }
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'clipboard')
  Reflect.deleteProperty(navigator, 'share')
})

describe('sharing a ticket', () => {
  it('builds the link from the current address and the ticket number', () => {
    expect(ticketLink('OT-1042')).toBe(`${window.location.origin}/t/OT-1042`)
    expect(equipmentLink('abc')).toBe(`${window.location.origin}/e/abc`)
  })

  it('reads a ticket number however it was typed', () => {
    for (const typed of ['OT-0123', 'ot-0123', 'OT-123', 'OT0123', '123', '0123', ' OT-123 ']) {
      expect(ticketNumber(typed)).toBe(123)
    }
    expect(ticketNumber('OT-1042')).toBe(1042)
  })

  it('leaves anything else alone', () => {
    for (const typed of ['66666666-6666-4666-8666-000000001042', 'not-a-ticket', 'OT-', '', 'OT-12a', '1234567890']) {
      expect(ticketNumber(typed)).toBeNull()
    }
  })

  it('opens the share sheet on a phone', async () => {
    const share = vi.fn(() => Promise.resolve())
    const { writeText } = device({ coarse: true, share })
    await expect(shareLink('https://x/t/1', 'OT-1')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'OT-1', url: 'https://x/t/1' })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('treats a cancelled sheet as nothing to report', async () => {
    const share = () => Promise.reject(Object.assign(new Error('no'), { name: 'AbortError' }))
    const { writeText } = device({ coarse: true, share })
    await expect(shareLink('u', 't')).resolves.toBe('shared')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies instead when the sheet fails, or on a phone without one', async () => {
    const share = () => Promise.reject(new Error('blocked'))
    const failing = device({ coarse: true, share })
    await expect(shareLink('u', 't')).resolves.toBe('copied')
    expect(failing.writeText).toHaveBeenCalledWith('u')

    device({ coarse: true })
    await expect(shareLink('u', 't')).resolves.toBe('copied')
  })

  it('copies on a computer, even one with a share sheet', async () => {
    const share = vi.fn(() => Promise.resolve())
    const { writeText } = device({ coarse: false, share })
    await expect(shareLink('u', 't')).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('u')
  })

  it('says so when it cannot copy', async () => {
    device({ coarse: false })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
    await expect(shareLink('u', 't')).resolves.toBe('failed')
  })
})
