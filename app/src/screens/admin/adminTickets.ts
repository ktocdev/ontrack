/**
 * Admin · Tickets' search (Admin-Tickets, OT-148): "Search tickets, equipment or OT-". A
 * ticket matches on its title, its unit, its category or where it sits on a checklist,
 * or its number, forgiving the dash and the case ("ot1042", "1042").
 */
type Searchable = {
  title: string
  display_id: string | null
  checklist_place?: string | null
  category: { name: string } | null
  equipment: { name: string } | null
}

const squash = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '')

export function matchesTicket(t: Searchable, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const words = [t.title, t.equipment?.name, t.category?.name, t.checklist_place]
  if (words.some((w) => w?.toLowerCase().includes(q))) return true
  const n = squash(q)
  return !!t.display_id && n.length > 0 && squash(t.display_id).includes(n)
}
