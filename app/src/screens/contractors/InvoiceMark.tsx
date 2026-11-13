import type { ReactNode } from 'react'
import { IconFile } from '../../components/icons'

/**
 * The tile that starts an invoice row, on the Invoices tab and on a contractor's
 * Invoices: a file on brand tint when one is attached, and a dashed yellow tile holding
 * `missing` (the board's + on the tab, a warning on the contractor's page) when not.
 */
export function InvoiceMark({ isMissing, missing }: { isMissing: boolean; missing: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-[34px] flex-none items-center justify-center rounded-tag ${
        isMissing
          ? 'border border-dashed border-reopened-banner-border bg-reopened-banner-bg text-status-waiting-text'
          : 'bg-brand-tint-soft text-brand'
      }`}
    >
      {isMissing ? missing : <IconFile size={16} />}
    </span>
  )
}
