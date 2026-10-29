import { useRegisterSW } from 'virtual:pwa-register/react'

/** One hourly check per page, even if registration runs twice (StrictMode, hot reload). */
let updateTimer: number | undefined
let onShow: (() => void) | undefined

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
      // Check hourly while open, and whenever the app comes back to the front:
      // people leave it in the background far more than they close it.
      window.clearInterval(updateTimer)
      updateTimer = window.setInterval(() => void registration.update(), 60 * 60 * 1000)
      if (onShow) document.removeEventListener('visibilitychange', onShow)
      onShow = () => {
        if (document.visibilityState === 'visible') void registration.update()
      }
      document.addEventListener('visibilitychange', onShow)
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
