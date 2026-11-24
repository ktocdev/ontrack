import { useState } from 'react'
import { useUser } from '../../auth/context'
import { isRestaurantSort, type RestaurantSort } from './dashboard'

/**
 * How this person sorts the dashboard's restaurants, remembered per person on this device
 * like their own order (useRestaurantOrder). Someone who had already dragged their own order
 * before Sort restaurants existed starts on Custom order, so nothing moves under them;
 * everyone else starts on Most urgent. View as shows Most urgent and remembers nothing.
 */
export function useRestaurantSort() {
  const { user, viewingAs } = useUser()
  const key = `ontrack.restaurantSort.${user.id}`
  const [sort, setSort] = useState<RestaurantSort>(() => {
    if (viewingAs) return 'urgent'
    try {
      const saved = localStorage.getItem(key)
      if (isRestaurantSort(saved)) return saved
      return localStorage.getItem(`ontrack.opsRestaurantOrder.${user.id}`) ? 'custom' : 'urgent'
    } catch {
      return 'urgent'
    }
  })

  const choose = (next: RestaurantSort) => {
    setSort(next)
    if (viewingAs) return
    try {
      localStorage.setItem(key, next)
    } catch {
      // Without storage the choice just lasts until the screen changes.
    }
  }

  return { sort, choose }
}
