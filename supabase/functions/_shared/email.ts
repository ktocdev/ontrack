/**
 * Sends through Resend. EMAIL_FROM names the sender; until the group's domain is
 * verified, Resend's test sender only delivers to the Resend account's own
 * address. EMAIL_SINK_URL is set only in config.toml for the local stack: mail
 * goes to its Mailpit inbox, so the flow tests can open a real invite email.
 */

export type Email = { to: string; subject: string; html: string; text: string; replyTo?: string }

const FROM = () => Deno.env.get('EMAIL_FROM') ?? 'OnTrack <onboarding@resend.dev>'

export async function sendEmail(email: Email): Promise<void> {
  const sink = Deno.env.get('EMAIL_SINK_URL')
  const res = sink
    ? await fetch(`${sink}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: { Email: 'onboarding@example.com', Name: 'OnTrack' },
          To: [{ Email: email.to }],
          Subject: email.subject,
          HTML: email.html,
          Text: email.text,
        }),
      })
    : await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM(),
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
      })
  if (!res.ok) {
    // Resend's reason (unverified domain, bad key) belongs in the function log.
    throw new Error(`email not sent: ${res.status} ${await res.text()}`)
  }
}

/** The shared frame of OnTrack's emails: the mark and name, then the body, on one card. */
export function emailFrame(body: string) {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:20px 16px;background:#E9EBE7;font-family:'Public Sans',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#15201B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px"><tr><td style="padding:28px 24px">
<p style="margin:0 0 18px;font-size:20px;font-weight:700;letter-spacing:-0.01em"><span style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:8px;background:#12634F;color:#ffffff;text-align:center;font-size:16px;margin-right:8px">&#10003;</span>OnTrack</p>
${body}
</td></tr></table>
</td></tr></table>
</body></html>`
}

export const emailStyles = {
  h1: 'margin:0 0 18px;font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.02em',
  p: 'margin:0 0 18px;font-size:15px;line-height:1.55;color:#2E3833',
  small: 'margin:0;font-size:13px;line-height:1.5;color:#5A645F',
  button:
    'display:block;margin:0 0 18px;padding:15px 20px;border-radius:12px;background:#12634F;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;text-align:center',
}
