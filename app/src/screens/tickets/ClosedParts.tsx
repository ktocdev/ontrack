import type { ReactNode } from 'react'
import { Card } from '../../components/Card'
import { SectionLabel } from '../../components/Screen'
import type { TimelineStep } from './closed'

/** A closed ticket's Resolution and Timeline cards and their rows, for managers and Ops. */

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border px-3.5 py-3 text-14 first:border-t-0">
      <span className="flex-none text-13 text-text-muted">{label}</span>
      <span className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</span>
    </div>
  )
}

export function Step({ title, note, when, dot }: { title: string; note: string | null; when: string; dot: string }) {
  return (
    <div className="flex gap-3 border-t border-border px-3.5 py-3 first:border-t-0">
      <span aria-hidden="true" className={`mt-[5px] h-2.5 w-2.5 flex-none rounded-full ${dot}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-14 font-semibold">{title}</span>
        {note && <span className="whitespace-pre-wrap text-14 leading-[1.4] text-text-body">{note}</span>}
        <span className="text-12 text-text-muted">{when}</span>
      </div>
    </div>
  )
}

/** The closing comment at the top of the Resolution card. */
export function ClosingComment({ heading, children }: { heading: string; children: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface-hover px-3.5 py-3">
      <span className="text-12 font-bold text-text-secondary">{heading}</span>
      <span className="whitespace-pre-wrap text-14 leading-[1.45] [overflow-wrap:anywhere]">{children}</span>
    </div>
  )
}

/** The ticket's life without the chat, with anything after it (a reopen just made) below. */
export function Timeline({ steps, children }: { steps: TimelineStep[]; children?: ReactNode }) {
  return (
    <>
      <SectionLabel className="-mb-0.5">Timeline</SectionLabel>
      <Card className="overflow-hidden">
        {steps.map((s) => (
          <Step key={s.key} title={s.title} note={s.note} when={s.when} dot={s.end ? 'bg-brand' : 'bg-border-muted'} />
        ))}
        {children}
      </Card>
    </>
  )
}
