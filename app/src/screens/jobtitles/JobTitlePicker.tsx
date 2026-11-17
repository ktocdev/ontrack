import { Chip } from '../../components/Chip'
import { useJobTitles } from './useJobTitles'

/**
 * The job title on Invite user and the User profile's Change sheet (OT-117): one chip per
 * title that is on, plus the person's own if it has been turned off since, so it can stay.
 * Tapping the picked chip takes the title off. Optional; a title grants nothing.
 */
export function JobTitlePicker({
  value,
  current = null,
  onChange,
}: {
  value: string | null
  /** The title they have now, offered even if it is turned off. */
  current?: string | null
  onChange: (id: string | null) => void
}) {
  const { data } = useJobTitles()
  const titles = (data ?? []).filter((t) => t.active || t.id === current)
  if (titles.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-col gap-0.5">
        <span className="text-13 font-semibold text-text-body">Job title</span>
        <span className="text-12 text-text-secondary">Optional. Shown beside their name, and starts their view.</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {titles.map((t) => (
          <Chip key={t.id} tone="pick" selected={value === t.id} onClick={() => onChange(value === t.id ? null : t.id)}>
            {t.name}
          </Chip>
        ))}
      </div>
    </div>
  )
}
