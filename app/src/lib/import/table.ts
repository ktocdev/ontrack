/**
 * A spreadsheet's rows as records (OT-137; for Phase 7's imports too): the first row with
 * anything in it is the header, matched to the columns by title or another name for it,
 * ignoring case, spaces and punctuation. Blank rows are skipped. Each record keeps its row
 * number as the spreadsheet shows it, so a problem can say where it is.
 */

export type Column<K extends string> = { key: K; title: string; aliases?: string[]; required?: boolean }

export type TableRecord<K extends string> = { row: number; values: Record<K, string> }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function readTable<K extends string>(rows: string[][], columns: Column<K>[]) {
  const headerAt = rows.findIndex((r) => r.some((c) => c.trim() !== ''))
  if (headerAt < 0) {
    return {
      records: [] as TableRecord<K>[],
      missing: columns.filter((c) => c.required).map((c) => c.title),
      unknown: [] as string[],
    }
  }
  const header = rows[headerAt]!.map((h) => norm(h))
  const index = new Map<K, number>()
  for (const c of columns) {
    const names = [c.title, ...(c.aliases ?? [])].map(norm)
    const at = header.findIndex((h) => h !== '' && names.includes(h))
    if (at >= 0) index.set(c.key, at)
  }
  const known = new Set(index.values())
  const unknown = rows[headerAt]!.filter((h, i) => h.trim() !== '' && !known.has(i)).map((h) => h.trim())
  const missing = columns.filter((c) => c.required && !index.has(c.key)).map((c) => c.title)
  const records: TableRecord<K>[] = []
  rows.slice(headerAt + 1).forEach((r, i) => {
    if (!r.some((c) => c.trim() !== '')) return
    const values = Object.fromEntries(columns.map((c) => [c.key, (r[index.get(c.key) ?? -1] ?? '').trim()])) as Record<
      K,
      string
    >
    records.push({ row: headerAt + i + 2, values })
  })
  return { records, missing, unknown }
}

/**
 * What changes between what is there and what comes in, matched by a key: added, changed
 * (by `same`), unchanged, and removed. Order follows what comes in, then what is left.
 */
export function diffByKey<A, B>(
  existing: A[],
  incoming: B[],
  keyOfExisting: (a: A) => string,
  keyOfIncoming: (b: B) => string,
  same: (a: A, b: B) => boolean,
) {
  const left = new Map<string, A[]>()
  for (const a of existing) left.set(keyOfExisting(a), [...(left.get(keyOfExisting(a)) ?? []), a])
  const added: B[] = []
  const changed: { from: A; to: B }[] = []
  const unchanged: B[] = []
  for (const b of incoming) {
    const match = left.get(keyOfIncoming(b))?.shift()
    if (!match) added.push(b)
    else if (same(match, b)) unchanged.push(b)
    else changed.push({ from: match, to: b })
  }
  const removed = [...left.values()].flat()
  return { added, changed, unchanged, removed }
}
