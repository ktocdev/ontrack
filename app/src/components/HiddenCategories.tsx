/**
 * The line at the top of a list that leaves categories off (OT-118; no board draws it):
 * "3 categories hidden · Show all". Show all lasts until the person leaves the screen, and
 * the line then offers the way back. It names categories, not tickets, so it says the same
 * on every list; My categories on Profile is where they change.
 */
export function HiddenCategories({
  count,
  showAll,
  onShowAll,
  className = '',
}: {
  /** How many categories the person hides. Nothing shows at none. */
  count: number
  showAll: boolean
  onShowAll: (showAll: boolean) => void
  className?: string
}) {
  if (count === 0) return null
  const categories = `${count} ${count === 1 ? 'category' : 'categories'}`
  return (
    <p className={`flex min-h-tap flex-none flex-wrap items-center gap-x-1 text-13 text-text-secondary ${className}`}>
      <span>{showAll ? `Showing all, with ${categories} you hide` : `${categories} hidden`}</span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        className="-mx-1 min-h-tap px-1 font-semibold text-brand"
        aria-pressed={showAll}
        onClick={() => onShowAll(!showAll)}
      >
        {showAll ? 'Hide them' : 'Show all'}
      </button>
    </p>
  )
}
