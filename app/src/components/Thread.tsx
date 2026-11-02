import type { FormEvent, ReactNode } from 'react'
import { IconArrowRight, IconChevronDown, IconEye, IconLockSmall } from './icons'

/**
 * A ticket's thread (design/screens/Ticket). An event is a 12px line with a dot; a
 * message is an avatar and a bubble with a square top-left corner, tinted brand when
 * it is yours, or gold and tagged when only Ops can read it. The composer is a growing
 * 44px field and a send button that lights once there is something to send.
 */

export function ThreadEvent({ text, when }: { text: string; when: string }) {
  return (
    <div className="flex items-center gap-2 px-0.5 py-2 text-12 text-text-muted">
      <i aria-hidden="true" className="mx-[9px] h-1.5 w-1.5 flex-none rounded-full bg-border-muted" />
      <span>
        {text} · {when}
      </span>
    </div>
  )
}

export function ThreadMessage({
  avatar,
  who,
  when,
  mine = false,
  internal = false,
  photos,
  children,
}: {
  avatar: ReactNode
  who: string
  when: string
  mine?: boolean
  /** An internal note. */
  internal?: boolean
  photos?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex gap-2.5 py-2">
      {avatar}
      <div
        className={`flex min-w-0 flex-1 flex-col gap-1 rounded-[4px_14px_14px_14px] border px-3 py-2.5 ${
          internal
            ? 'border-[var(--reopened-banner-border)] bg-[var(--reopened-banner-bg)]'
            : mine
              ? 'border-brand-tint-border bg-brand-tint-soft'
              : 'border-border bg-surface'
        }`}
      >
        <span className="text-12 font-bold text-text-body">
          {who} <span className="font-medium text-text-muted">· {when}</span>
          {internal && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-chip bg-status-waiting-bg px-1.5 py-px align-middle text-11 font-bold text-status-waiting-text">
              <IconLockSmall size={11} />
              Ops only
            </span>
          )}
        </span>
        {children && (
          <span className="whitespace-pre-wrap text-14 leading-[1.45] text-text [overflow-wrap:anywhere]">
            {children}
          </span>
        )}
        {photos && <div className="mt-0.5 flex flex-wrap gap-2">{photos}</div>}
      </div>
    </div>
  )
}

/**
 * Who an update reaches (Ops-Ticket): a 32px pill inside a 44px tap target. It stays as
 * set after posting, since an internal note going out by accident is the worse mistake.
 */
export function VisibilityToggle({ internal, onChange }: { internal: boolean; onChange: (internal: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={internal}
      onClick={() => onChange(!internal)}
      className="-mb-1.5 -mt-1.5 flex min-h-tap flex-none items-center self-start"
    >
      <span
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-pill border px-2.5 text-12 font-semibold ${
          internal
            ? 'border-[var(--reopened-banner-border)] bg-[var(--reopened-banner-bg)] text-status-waiting-text'
            : 'border-border-strong bg-surface text-text-body'
        }`}
      >
        {internal ? <IconLockSmall size={14} /> : <IconEye size={14} />}
        {internal ? 'Internal note · Ops only' : 'Visible to restaurant'}
        <IconChevronDown size={12} strokeWidth={2.4} />
      </span>
    </button>
  )
}

const MAX_HEIGHT = 120

export function Composer({
  value,
  onChange,
  onSend,
  busy = false,
  label,
  placeholder,
  maxLength,
  canSendEmpty = false,
  leading,
  above,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  busy?: boolean
  label: string
  placeholder: string
  maxLength?: number
  /** There is something to send without words: a picked photo. */
  canSendEmpty?: boolean
  /** Beside the field, on its left: the camera. */
  leading?: ReactNode
  /** Over the field: what has been picked. */
  above?: ReactNode
}) {
  const empty = !value.trim() && !canSendEmpty

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    const needed = el.scrollHeight + 2
    el.style.height = `${Math.min(needed, MAX_HEIGHT)}px`
    // scrollHeight rounds a 22.4px line down, so without this a phone can draw a scrollbar at one line.
    el.style.overflowY = needed > MAX_HEIGHT ? 'auto' : 'hidden'
  }
  // Grow to fit what's there, including back down to one line once it is sent.
  const setRef = (el: HTMLTextAreaElement | null) => {
    if (el) grow(el)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!empty && !busy) onSend()
  }

  return (
    <form
      onSubmit={submit}
      className="relative flex flex-none flex-col gap-2.5 border-t border-border bg-surface px-3 pb-[max(24px,var(--safe-bottom))] pt-2.5"
    >
      {above}
      <div className="flex items-end gap-2">
        {leading}
        <textarea
          ref={setRef}
          rows={1}
          aria-label={label}
          placeholder={placeholder}
          maxLength={maxLength}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            grow(e.target)
          }}
          className="max-h-[120px] min-h-tap min-w-0 flex-1 resize-none rounded-[22px] border border-border-strong bg-surface-hover px-4 py-[11px] leading-[1.4] text-text outline-none transition-colors placeholder:text-text-muted focus:border-brand"
        />
        <button
          type="submit"
          aria-label="Post update"
          disabled={empty || busy}
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-full transition-colors active:duration-0 ${
            empty
              ? 'cursor-not-allowed bg-border text-text-secondary'
              : 'bg-brand-fill text-on-brand not-disabled:hover:bg-brand-fill-hover'
          }`}
        >
          <IconArrowRight size={20} strokeWidth={2.2} />
        </button>
      </div>
    </form>
  )
}
