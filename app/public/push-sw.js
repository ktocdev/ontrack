/* Imported by the generated service worker (workbox.importScripts in vite.config.ts), so
   the app's update prompt and precache stay as they were. Shows a push and opens its page. */

self.addEventListener('push', (event) => {
  let note = {}
  try {
    note = event.data ? event.data.json() : {}
  } catch {
    // A push that isn't ours to read still has to show something, or the browser complains.
  }
  event.waitUntil(
    self.registration.showNotification(note.title || 'OnTrack', {
      body: note.body || '',
      tag: note.tag,
      icon: '/pwa-192.png',
      vibrate: [200, 100, 200],
      data: { url: note.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Only ever a page of this app, whatever the push said.
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  const target = url.origin === self.location.origin ? url.href : self.location.origin + '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0]
      if (!open) return self.clients.openWindow(target)
      return open.focus().then((client) => (client.navigate ? client.navigate(target) : client))
    }),
  )
})
