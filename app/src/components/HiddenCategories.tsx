import { listNames } from '../lib/words'

/**
 * The line under a list that leaves categories off (OT-118; no board draws it; below the
 * list since OT-176): "3 categories hidden · Show all: Plumbing, Bar, IT". The button names
 * what it brings back, an area hidden whole by the area's name, up to three and then how
 * many more. Show all lasts until the person leaves the screen, and the line then offers
 * the way back. It names categories, not tickets, so it says the same on every list; My
 * categories on Profile is where they change.
 */
export function HiddenCategories({
  count,
  names,
  showAll,
  onShowAll,
  className = '',
}: {
  /** How many categories the person hides. Nothing shows at none. */
  count: number
  /** What they hide, in order: an area's name where it is hidden whole, else each category's. */
  names: string[]
  showAll: boolean
  onShowAll: (showAll: boolean) => void
  className?: string
}) {
  if (count === 0) return null
  const categories = `${count} ${count === 1 ? 'category' : 'categories'}`
  const which = listNames(names)
  return (
    <p className={`flex min-h-tap flex-none flex-wrap items-center gap-x-1 text-13 text-text-secondary ${className}`}>
      <span>{showAll ? `Showing all, with ${categories} you hide` : `${categories} hidden`}</span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        className="-mx-1 min-h-tap px-1 text-left font-semibold text-brand"
        aria-pressed={showAll}
        onClick={() => onShowAll(!showAll)}
      >
        {showAll ? 'Hide them' : which ? `Show all: ${which}` : 'Show all'}
      </button>
    </p>
  )
}
