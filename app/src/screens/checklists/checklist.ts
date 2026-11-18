/**
 * The checklist editor's shape (OT-136): a section's items fall into groups by name, the
 * groups in the order of their first item, as the walkthrough's checklist shows them.
 */

export function groupsOf<T extends { group_name: string; sort_order: number }>(items: T[]) {
  const groups: { name: string; items: T[] }[] = []
  for (const i of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const g = groups.find((x) => x.name === i.group_name)
    if (g) g.items.push(i)
    else groups.push({ name: i.group_name, items: [i] })
  }
  return groups
}

/** Every item's id in group order, once the groups are put in the order given. */
export function idsByGroups<T extends { id: string; group_name: string; sort_order: number }>(
  items: T[],
  groupOrder: string[],
) {
  const groups = groupsOf(items)
  return groupOrder.flatMap((name) => groups.find((g) => g.name === name)?.items.map((i) => i.id) ?? [])
}

/** "Electrical · video" under an item: its category, and whether it has directions and a video. */
export function itemLine(i: { directions: string | null; video_url: string | null }, category: string | null) {
  return [category ?? 'No category', i.directions ? 'directions' : null, i.video_url ? 'video' : null]
    .filter(Boolean)
    .join(' · ')
}
