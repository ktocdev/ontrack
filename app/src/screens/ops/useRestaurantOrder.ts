import { useState } from 'react'
import { useUser } from '../../auth/context'
import { inChosenOrder } from './dashboard'

/**
 * The order this person wants their restaurants in, remembered per person on this
 * device. View as shows the group's own order and remembers nothing.
 */
export function useRestaurantOrder() {
  const { user, restaurants, viewingAs } = useUser()
  const key = `ontrack.opsRestaurantOrder.${user.id}`
  const [chosen, setChosen] = useState<string[]>(() => {
    if (viewingAs) return []
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
    } catch {
      return []
    }
  })

  const reorder = (ids: string[]) => {
    setChosen(ids)
    try {
      localStorage.setItem(key, JSON.stringify(ids))
    } catch {
      // Without storage the order just lasts until the screen changes.
    }
  }

  return { ordered: inChosenOrder(restaurants, chosen), reorder }
}
