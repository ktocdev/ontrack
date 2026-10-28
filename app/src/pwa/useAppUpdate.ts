import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Registers the service worker and exposes whether a newer build is waiting.
 * The worker is built with registerType 'prompt' so a user mid-form is never
 * reloaded under them; the shell shows a small Update affordance instead.
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new build every hour while the app stays open on a phone.
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  return {
    needRefresh,
    offlineReady,
    applyUpdate: () => updateServiceWorker(true),
    dismiss: () => {
      setNeedRefresh(false)
      setOfflineReady(false)
    },
  }
}
