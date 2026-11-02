import type { ReactNode } from 'react'

/** The rows inside a closed ticket's Resolution and Timeline cards, for managers and Ops. */

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
