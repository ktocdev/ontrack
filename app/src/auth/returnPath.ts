/**
 * The page to return to after sign-in: only ever a page of this app. A path like
 * "//evil.com/x" or "/\evil.com" reads as another site to the browser, and the router
 * falls back to a plain navigation when the history API refuses such a path, so neither
 * may become a return path (OT-55).
 */
export function safeReturnPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/')) return null
  if (/^\/[\\/]/.test(path)) return null
  return path
}
