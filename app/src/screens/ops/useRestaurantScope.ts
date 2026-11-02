import { useState } from 'react'
import { useUser } from '../../auth/context'

/**
 * The restaurant picker's choice, which scopes every Ops screen: one restaurant, or
 * null for all of them. Each screen reads it as it opens, and it is remembered per
 * person on this device. A restaurant no longer in the person's list falls back to
 * all. View as starts on all and remembers nothing.
 */
export function useRestaurantScope() {
  const { user, restaurants, viewingAs } = useUser()
  const key = `ontrack.opsRestaurant.${user.id}`
  const [chosen, setChosen] = useState<string | null>(() => {
    if (viewingAs) return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  })

  const selected = restaurants.find((r) => r.id === chosen) ?? null
  const select = (id: string | null) => {
    setChosen(id)
    if (viewingAs) return
    try {
      if (id) localStorage.setItem(key, id)
      else localStorage.removeItem(key)
    } catch {
      // Without storage the choice just lasts until the screen changes.
    }
  }

  return { selected, select, ids: selected ? [selected.id] : restaurants.map((r) => r.id) }
}
