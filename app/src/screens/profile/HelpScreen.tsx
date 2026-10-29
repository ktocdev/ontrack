import { useId, useState } from 'react'
import { ListCard, ListRow, ListRowAnchor, ListRowButton, RowIcon } from '../../components/Card'
import { SearchField } from '../../components/Field'
import { Screen, ScreenBody, SectionLabel, TitleBar } from '../../components/Screen'
import { IconChevronDown, IconChevronRight, IconKey, IconMail, IconPhone, IconReport } from '../../components/icons'
import { env } from '../../lib/env'
import { ReportSheet } from './ReportSheet'

/**
 * Profile · Help & support (design/screens/Help), any role. Search narrows
 * the questions; one answer is open at a time. Email and Call support come
 * from VITE_SUPPORT_EMAIL / VITE_SUPPORT_PHONE and hide when unset. The
 * board's "Can't sign in?" row arrives with the reset flow (OT-10), and its
 * Terms and Privacy links wait for those pages.
 */
export const FAQS = [
  {
    q: 'How do I report broken equipment?',
    a: 'Scan the QR label on the equipment, or tap Create ticket and pick the area and category. Add a photo if you can. Your Ops Manager is notified right away.',
  },
  {
    q: 'Who sees my tickets?',
    a: 'Managers at your restaurant and all Ops Managers. Leadership and admins can view tickets but not change them.',
  },
  {
    q: 'What does each status mean?',
    a: 'Open: not picked up yet. In progress: an Ops Manager is on it. Waiting on parts: work is paused until parts arrive. Closed: fixed.',
  },
  {
    q: 'The problem came back after a ticket closed',
    a: 'Open the closed ticket and tap Reopen ticket within 30 days. After that, create a new ticket from it so the history stays linked.',
  },
  {
    q: 'A QR label is missing or won’t scan',
    a: 'Search for the equipment by name or serial number instead. Ops Managers can print a new label from the equipment’s Details tab.',
  },
  {
    q: 'How do walkthroughs work?',
    a: 'Each walkthrough is a checklist for your restaurant. Mark items as you go. Anything that needs fixing becomes a ticket when you submit.',
  },
]

/** Show a stored number the way people read it: (312) 555-0100 for 10 US digits. */
function displayPhone(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw
}

export function HelpScreen() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(0)
  const [reportOpen, setReportOpen] = useState(false)
  const baseId = useId()

  const q = query.trim().toLowerCase()
  const faqs = FAQS.map((f, i) => ({ ...f, i })).filter((f) => !q || `${f.q} ${f.a}`.toLowerCase().includes(q))

  return (
    <Screen>
      <TitleBar to="/profile" label="Back to profile" title="Help & support" />

      <ScreenBody className="gap-3 pb-6 pt-5">
        <SearchField
          label="Search help"
          placeholder="Search help articles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <SectionLabel className="-mb-0.5">Get in touch</SectionLabel>
        <ListCard>
          <ListRowButton
            onClick={() => setReportOpen(true)}
            leading={
              <RowIcon>
                <IconReport />
              </RowIcon>
            }
            title="Report a problem"
            subtitle="Something not working? Tell support."
            trailing={<IconChevronRight className="text-text-muted" />}
          />
          {env.supportEmail && (
            <ListRowAnchor
              href={`mailto:${env.supportEmail}`}
              leading={
                <RowIcon>
                  <IconMail />
                </RowIcon>
              }
              title="Email support"
              subtitle="Replies within 1 business day"
            />
          )}
          {env.supportPhone && (
            <ListRowAnchor
              href={`tel:${env.supportPhone.replace(/[^\d+]/g, '')}`}
              leading={
                <RowIcon>
                  <IconPhone />
                </RowIcon>
              }
              title="Call support"
              subtitle={displayPhone(env.supportPhone)}
            />
          )}
        </ListCard>
        <span className="-mt-1 text-12 text-text-muted">
          For a broken piece of equipment, create a ticket instead. Support can&apos;t send a contractor.
        </span>

        <SectionLabel className="-mb-0.5">Common questions</SectionLabel>
        {faqs.length ? (
          <ListCard>
            {faqs.map((f) => {
              const isOpen = open === f.i || Boolean(q)
              const answerId = `${baseId}-a${f.i}`
              return (
                <div key={f.i} className="border-t border-border first:border-t-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => setOpen(open === f.i ? -1 : f.i)}
                    className="flex min-h-[52px] w-full items-center gap-2.5 bg-surface px-3.5 text-left text-14 font-semibold leading-5 text-text transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0"
                  >
                    <span className="flex-1 py-3">{f.q}</span>
                    <IconChevronDown
                      size={16}
                      className={`flex-none text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <p id={answerId} className="m-0 px-3.5 pb-3.5 text-14 leading-normal text-text-body">
                      {f.a}
                    </p>
                  )}
                </div>
              )
            })}
          </ListCard>
        ) : (
          <p className="text-14 text-text-secondary">
            No questions match &ldquo;{query.trim()}&rdquo;. Try another word, or report the problem above.
          </p>
        )}

        <SectionLabel className="-mb-0.5">Account</SectionLabel>
        <ListCard>
          <ListRow
            leading={
              <RowIcon>
                <IconKey />
              </RowIcon>
            }
            title="Need a different role or restaurant?"
            subtitle="Your admin manages roles and restaurants"
          />
        </ListCard>

        <span className="pt-4 text-center text-12 text-text-muted">OnTrack · Version {env.appVersion}</span>
      </ScreenBody>

      <ReportSheet open={reportOpen} onOpenChange={setReportOpen} />
    </Screen>
  )
}
