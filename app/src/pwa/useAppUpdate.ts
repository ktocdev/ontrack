import { useRegisterSW } from 'virtual:pwa-register/react'

/** One hourly check per page, even if registration runs twice (StrictMode, hot reload). */
let updateTimer: number | undefined

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
      if (!registration) return
      window.clearInterval(updateTimer)
      updateTimer = window.setInterval(() => void registration.update(), 60 * 60 * 1000)
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
