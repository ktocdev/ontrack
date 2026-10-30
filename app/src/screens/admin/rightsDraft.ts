/**
 * What a draft of the grid or of one person's rights changes. Pure, so the rules
 * can be tested without a screen.
 */

/** Cells that differ from what is saved, in the order they were given. */
export function changedCells<T extends { id: string }>(
  cells: T[],
  saved: (cell: T) => boolean,
  draft: ReadonlyMap<string, boolean>,
) {
  return cells.flatMap((cell) => {
    const value = draft.get(cell.id)
    return value !== undefined && value !== saved(cell) ? [{ cell, allowed: value }] : []
  })
}

/**
 * The override a person's switch should store: none when it matches the role's
 * default, so a later change to the default still reaches them.
 */
export function overrideFor(value: boolean, roleDefault: boolean): boolean | null {
  return value === roleDefault ? null : value
}

/** "2 rights" / "1 right". */
export function countRights(count: number) {
  return count === 1 ? '1 right' : `${count} rights`
}

/** "3 people" / "1 person". */
export function countPeople(count: number) {
  return count === 1 ? '1 person' : `${count} people`
}
