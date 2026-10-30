/**
 * One choice in a radio group, as a card (Invite user: role): 56px, a 20px radio
 * ring, a 15px title and a 12px line under it. Selected, the border goes to 2px
 * brand and the padding gives back the extra pixel so nothing moves.
 */
export function RadioCard({
  checked,
  title,
  subtitle,
  onSelect,
}: {
  checked: boolean
  title: string
  subtitle: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex min-h-14 w-full items-center gap-3 rounded-input text-left transition-colors active:duration-0 ${
        checked
          ? 'border-2 border-brand bg-brand-tint-faint px-[13px] py-[7px]'
          : 'border border-border bg-surface px-3.5 py-2 hover:border-border-strong active:bg-surface-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-5 w-5 flex-none rounded-full ${checked ? 'border-[6px] border-brand' : 'border-2 border-border-muted'}`}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-15 font-semibold text-text">{title}</span>
        <span className="text-12 text-text-secondary">{subtitle}</span>
      </span>
    </button>
  )
}
