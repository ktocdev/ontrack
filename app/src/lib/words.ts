/**
 * Small pieces of wording the lists share: a person's first name, a short day, and what
 * counts as a how-to video link.
 */

/** "Maya" from "Maya Reyes", for a line like "Added by Maya"; nothing for no name. */
export function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || undefined
}

/** A day as the lists write it: "Nov 18". */
export function shortDay(at: string | Date) {
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The same, with "today" for today. */
export function shortDayOrToday(at: string | Date, now = new Date()) {
  return new Date(at).toDateString() === now.toDateString() ? 'today' : shortDay(at)
}

/** What the app shows as a how-to link: a web address and nothing more, as the database holds. */
export function isVideoUrl(url: string) {
  return /^https?:\/\/\S+$/i.test(url) && url.length <= 500
}
