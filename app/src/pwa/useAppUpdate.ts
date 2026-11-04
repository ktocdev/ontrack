import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** One hourly check per page, even if registration runs twice (StrictMode, hot reload). */
let updateTimer: number | undefined
let onShow: (() => void) | undefined

/**
 * Registers the service worker and exposes whether a newer build is waiting.
 * The worker is built with registerType 'prompt' so a user mid-form is never
 * reloaded under them; the shell shows a small Update affordance instead.
 * Update waits for the new worker to take over, which can take a few seconds, so
 * `updating` says it is under way, and the page reloads itself if the worker never
 * reports back (another tab took it over first, or the message was lost).
 */
export function useAppUpdate() {
  const [updating, setUpdating] = useState(false)
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
    updating,
    applyUpdate: () => {
      if (updating) return
      setUpdating(true)
      window.setTimeout(() => window.location.reload(), 10_000)
      void updateServiceWorker(true)
    },
    dismiss: () => {
      setNeedRefresh(false)
      setOfflineReady(false)
    },
  }
}
