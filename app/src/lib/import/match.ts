/**
 * Matching for spreadsheet imports (OT-150; the contractor and equipment imports, OT-151 and
 * OT-152): how close a word in someone's sheet is to one OnTrack knows, a one-tap suggestion
 * for a value that matches nothing on a list ("Refrig." → Refrigeration, "Federales LS" →
 * Federale’s Logan Square), and the values that match nothing, grouped so one fix covers
 * every row that has them.
 */

/** Lower case, accents and apostrophes off, anything else that isn't a letter or digit a space. */
export function words(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const squash = (s: string) => words(s).replace(/ /g, '')

function bigrams(s: string) {
  const out = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1)
  return out
}

/** How alike two strings' letter pairs are, 0 to 1 (Dice). */
function dice(a: string, b: string) {
  if (a.length < 2 || b.length < 2) return 0
  const x = bigrams(a)
  const y = bigrams(b)
  let both = 0
  for (const [k, n] of x) both += Math.min(n, y.get(k) ?? 0)
  return (2 * both) / (a.length - 1 + b.length - 1)
}

/**
 * Whether every word typed stands for the target's words in order: the same word, the start
 * of one ("refrig", "ins"), or the initials of several ("ls" for Logan Square). Every word
 * of the target must be covered: "federales" alone doesn't stand for Federale’s Logan Square.
 */
function abbreviates(typed: string[], target: string[]) {
  let at = 0
  for (const t of typed) {
    const word = target[at]
    if (word === undefined) return false
    if (word === t || (t.length >= 2 && word.startsWith(t))) {
      at += 1
      continue
    }
    // Initials: "ls" → logan square.
    if (t.length >= 2 && /^[a-z]+$/.test(t) && t.split('').every((ch, i) => target[at + i]?.startsWith(ch))) {
      at += t.length
      continue
    }
    return false
  }
  return at === target.length
}

/** How close what someone typed is to a name OnTrack has, 0 to 1. */
export function closeness(typed: string, name: string) {
  const a = words(typed)
  const b = words(name)
  if (!a || !b) return 0
  if (a === b) return 1
  if (squash(a) === squash(b)) return 0.98
  if (abbreviates(a.split(' '), b.split(' '))) return 0.9
  // One word cut short: "refrig" for refrigeration.
  if (squash(a).length >= 3 && squash(b).startsWith(squash(a))) return 0.85
  return dice(squash(a), squash(b)) * 0.8
}

export type Option = { id: string; name: string; aliases?: string[] }

/** The option a value names exactly (ignoring case, spaces and punctuation), if any. */
export function exactOption<O extends Option>(value: string, options: O[]) {
  const v = squash(value)
  if (!v) return undefined
  return options.find((o) => [o.name, ...(o.aliases ?? [])].some((n) => squash(n) === v))
}

/** Close enough to offer as a suggestion. */
export const SUGGEST_AT = 0.5

/**
 * The option a value most likely means, to offer with one tap, or undefined when nothing is
 * close or two are equally close ("Federales" could be either Federale’s).
 */
export function suggestOption<O extends Option>(value: string, options: O[]) {
  const exact = exactOption(value, options)
  if (exact) return exact
  let best: O | undefined
  let bestScore = 0
  let tie = false
  for (const o of options) {
    const score = Math.max(...[o.name, ...(o.aliases ?? [])].map((n) => closeness(value, n)))
    if (score > bestScore + 1e-9) {
      best = o
      bestScore = score
      tie = false
    } else if (Math.abs(score - bestScore) <= 1e-9) {
      tie = true
    }
  }
  return bestScore >= SUGGEST_AT && !tie ? best : undefined
}

/**
 * Values on rows that match no option, grouped by the value as typed (ignoring case and
 * spaces), most rows first, each with its rows and a suggestion: the review's "“Refrig.”
 * isn’t a trade · 3 rows". An empty value is not here; a missing value is its own problem.
 */
export function unmatchedValues<R extends { row: number }, O extends Option>(
  rows: R[],
  valuesOf: (r: R) => string[],
  options: O[],
) {
  const groups = new Map<string, { value: string; rows: R[]; suggestion: O | undefined }>()
  for (const r of rows) {
    for (const value of valuesOf(r)) {
      const v = value.trim()
      if (!v || exactOption(v, options)) continue
      const key = squash(v)
      const group = groups.get(key)
      if (group) {
        if (!group.rows.includes(r)) group.rows.push(r)
      } else groups.set(key, { value: v, rows: [r], suggestion: suggestOption(v, options) })
    }
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.rows[0]!.row - b.rows[0]!.row)
}
