import { describe, expect, it, vi } from 'vitest'
import source from '../../public/push-sw.js?raw'

/** Runs public/push-sw.js against a stand-in for the worker's global, which Playwright can't reach. */
function worker(windows: unknown[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {}
  const self = {
    location: { origin: 'https://app.example' },
    addEventListener: (name: string, fn: (event: unknown) => void) => {
      handlers[name] = fn
    },
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
    clients: {
      matchAll: vi.fn(() => Promise.resolve(windows)),
      openWindow: vi.fn(() => Promise.resolve()),
    },
  }
  new Function('self', source)(self)

  const push = async (data: unknown) => {
    let done: Promise<unknown> = Promise.resolve()
    handlers.push!({ data, waitUntil: (p: Promise<unknown>) => (done = p) })
    await done
  }
  const click = async (url?: string) => {
    let done: Promise<unknown> = Promise.resolve()
    handlers.notificationclick!({
      notification: { close: () => undefined, data: { url } },
      waitUntil: (p: Promise<unknown>) => (done = p),
    })
    await done
  }
  return { self, push, click }
}

describe('the push worker', () => {
  it('shows what the push says, and buzzes', async () => {
    const { self, push } = worker()
    await push({ json: () => ({ title: 'OT-1042', body: 'In progress', url: '/t/abc', tag: 'abc' }) })
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'OT-1042',
      expect.objectContaining({ body: 'In progress', tag: 'abc', vibrate: [200, 100, 200], data: { url: '/t/abc' } }),
    )
  })

  it('still shows something for a push it can’t read, since the browser requires it', async () => {
    const { self, push } = worker()
    await push({
      json: () => {
        throw new Error('not json')
      },
    })
    expect(self.registration.showNotification).toHaveBeenCalledWith('OnTrack', expect.anything())
  })

  it('opens the page when no window is open', async () => {
    const { self, click } = worker()
    await click('/t/abc')
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://app.example/t/abc')
  })

  it('reuses a window that is already open', async () => {
    const client = { navigate: vi.fn(() => Promise.resolve()) }
    const open = { focus: vi.fn(() => Promise.resolve(client)) }
    const { self, click } = worker([open])
    await click('/t/abc')
    expect(open.focus).toHaveBeenCalled()
    expect(client.navigate).toHaveBeenCalledWith('https://app.example/t/abc')
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })

  it('only ever opens this app, whatever the push said', async () => {
    const { self, click } = worker()
    await click('https://evil.example/phish')
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://app.example/')
  })
})
