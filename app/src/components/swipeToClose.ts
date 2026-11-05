import { useCallback, useEffect, useRef } from 'react'

/**
 * Swipe down to close a bottom sheet, as a phone's own sheets do. A swipe starts
 * anywhere on the sheet, but only while it and whatever is under the finger are
 * scrolled to the top, so a swipe on a list inside it scrolls the list first. It
 * never starts on a field or on a drag handle (`touch-none`, as Reorder restaurants'
 * are, or `data-no-swipe`). The sheet follows the finger; let go past a third of its
 * height, or with a quick flick, and it slides away, otherwise it springs back. From
 * the lg breakpoint the sheet is a centered dialog and none of this applies.
 *
 * Touch events, not pointer events: the sheet scrolls, so the browser would take a
 * pointer for itself and cancel it, while a touchmove can still be held back.
 */

/** Past this share of the sheet's height, letting go closes it. */
export const CLOSE_FRACTION = 1 / 3
/** A flick this fast (px per ms) closes it from any distance past FLICK_MIN. */
export const FLICK_SPEED = 0.5
export const FLICK_MIN = 24
/** How far the finger moves down before the sheet starts to follow. */
const SLOP = 8

export function shouldClose(dy: number, height: number, velocity: number) {
  return dy > height * CLOSE_FRACTION || (dy > FLICK_MIN && velocity > FLICK_SPEED)
}

const NO_SWIPE = 'input, textarea, select, [contenteditable], [data-no-swipe], .touch-none'

/** A ref for the sheet's panel. With `enabled` false (a sheet that must stay) it does nothing. */
export function useSwipeToClose(onClose: () => void, enabled: boolean) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  return useCallback(
    (el: HTMLElement | null) => {
      if (!el || !enabled) return
      let tracking = false
      let dragging = false
      let startX = 0
      let startY = 0
      let lastY = 0
      let lastT = 0
      let velocity = 0

      const scrolled = (target: EventTarget | null) => {
        for (let n = target instanceof Element ? target : null; n; n = n.parentElement) {
          if (n.scrollTop > 0) return true
          if (n === el) return false
        }
        return false
      }
      const settle = (transform: string, transition: string) => {
        el.style.transition = transition
        el.style.transform = transform
      }

      const start = (e: TouchEvent) => {
        tracking = false
        const t = e.touches[0]
        if (e.touches.length !== 1 || !t || matchMedia('(min-width: 64rem)').matches) return
        if (e.target instanceof Element && e.target.closest(NO_SWIPE)) return
        if (scrolled(e.target)) return
        tracking = true
        dragging = false
        startX = t.clientX
        startY = lastY = t.clientY
        lastT = e.timeStamp
        velocity = 0
      }
      const move = (e: TouchEvent) => {
        const t = e.touches[0]
        if (!tracking || !t) return
        const dy = t.clientY - startY
        if (!dragging) {
          // Up, or more across than down, is someone scrolling or swiping something else.
          if (dy < -SLOP / 2 || Math.abs(t.clientX - startX) > Math.abs(dy)) {
            tracking = false
            return
          }
          if (dy < SLOP) return
          dragging = true
        }
        e.preventDefault()
        const dt = e.timeStamp - lastT
        if (dt > 0) velocity = (t.clientY - lastY) / dt
        lastY = t.clientY
        lastT = e.timeStamp
        settle(`translateY(${Math.max(0, dy - SLOP)}px)`, 'none')
      }
      const end = (e: TouchEvent) => {
        if (!tracking) return
        tracking = false
        if (!dragging) return
        dragging = false
        // A finger held still before letting go is not a flick.
        if (e.timeStamp - lastT > 100) velocity = 0
        if (shouldClose(lastY - startY, el.offsetHeight, velocity)) {
          settle('translateY(100%)', 'transform .18s ease-in')
          setTimeout(() => {
            close.current()
            // If the sheet stays open after all, put it back.
            setTimeout(() => settle('', ''), 50)
          }, 180)
        } else {
          settle('', 'transform .2s ease-out')
        }
      }

      el.addEventListener('touchstart', start, { passive: true })
      el.addEventListener('touchmove', move, { passive: false })
      el.addEventListener('touchend', end)
      el.addEventListener('touchcancel', end)
      return () => {
        el.removeEventListener('touchstart', start)
        el.removeEventListener('touchmove', move)
        el.removeEventListener('touchend', end)
        el.removeEventListener('touchcancel', end)
      }
    },
    [enabled],
  )
}
