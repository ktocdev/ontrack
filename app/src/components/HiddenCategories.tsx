import { listNames } from '../lib/words'

/**
 * The line under a list that leaves categories off (OT-118; no board draws it; below the
 * list since OT-176): "1 area hidden · Show all", counting an area hidden whole as one and
 * any other hidden category on its own ("1 area and 2 categories hidden"). Only once Show
 * all is on does it name them ("Showing IT, which you hide · Hide them"). Show all lasts
 * until the person leaves the screen. It names categories, not tickets, so it says the same
 * on every list; My categories on Profile is where they change.
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
  /** What they hide, in order: the areas hidden whole, and the categories hidden elsewhere. */
  names: { areas: string[]; categories: string[] }
  showAll: boolean
  onShowAll: (showAll: boolean) => void
  className?: string
}) {
  if (count === 0) return null
  const counted = [
    plural(names.areas.length, 'area', 'areas'),
    plural(names.categories.length, 'category', 'categories'),
  ].filter(Boolean)
  const which = listNames([...names.areas, ...names.categories])
  return (
    <p className={`flex min-h-tap flex-none flex-wrap items-center gap-x-1 text-13 text-text-secondary ${className}`}>
      <span>{showAll ? `Showing ${which}, which you hide` : `${counted.join(' and ')} hidden`}</span>
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

function plural(n: number, one: string, many: string) {
  return n === 0 ? '' : `${n} ${n === 1 ? one : many}`
}
