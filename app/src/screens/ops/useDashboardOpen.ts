import { useCallback, useEffect, useState } from 'react'

/**
 * Which restaurants are open on the Ops dashboard (from feedback, Nov 23, 2026). The ops
 * manager reads it first thing, so every restaurant starts closed, showing only its urgent
 * tickets; one opened stays open on this device for the rest of the day, and the next day
 * they all start closed again. The day is the phone's own date, read again whenever the app
 * comes back to the front, since an installed app is often resumed rather than reloaded.
 * Under View as nothing is kept: the admin's choices aren't the viewed person's.
 */
const KEY = 'ontrack.dashboard-open'

type Saved = { day: string; ids: string[] }

export const today = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

/** What was saved, if it was saved today; anything else (another day, nothing, junk) is none. */
export function readOpen(raw: string | null, day: string): string[] {
  try {
    const saved = JSON.parse(raw ?? 'null') as Partial<Saved> | null
    if (saved?.day !== day || !Array.isArray(saved.ids)) return []
    return saved.ids.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

function load() {
  try {
    return readOpen(localStorage.getItem(KEY), today())
  } catch {
    return []
  }
}

export function useDashboardOpen(keep: boolean) {
  const [ids, setIds] = useState<string[]>(() => (keep ? load() : []))
  const [day, setDay] = useState(today)

  // A new day while the app sat in the background closes them all again.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible' || today() === day) return
      setDay(today())
      setIds([])
    }
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [day])

  const toggle = useCallback(
    (id: string) =>
      setIds((was) => {
        const next = was.includes(id) ? was.filter((x) => x !== id) : [...was, id]
        if (keep) {
          try {
            localStorage.setItem(KEY, JSON.stringify({ day: today(), ids: next } satisfies Saved))
          } catch {
            // Storage refused (a private window): it still works until the app closes.
          }
        }
        return next
      }),
    [keep],
  )

  return { isOpen: (id: string) => ids.includes(id), toggle }
}
