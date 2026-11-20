/** The database's "row 14: …" with a capital, or a plain line when the connection failed. */
export function importMessage(error: unknown) {
  const message = (error as { message?: string } | null)?.message ?? ''
  if (/^row \d+:/.test(message)) return `Row ${message.slice(4)}.`
  return 'Check your connection and try again.'
}
