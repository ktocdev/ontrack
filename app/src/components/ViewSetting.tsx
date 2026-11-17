import type { Database } from '../lib/database.types'
import { Segmented } from './Segmented'

/**
 * The two settings My categories keeps for an area or a category (OT-116): Notify me (All,
 * Urgent only, Off) and Show on my lists. No board draws them; both are a Segmented, not a
 * switch, since they sit in forms with a Save button. Used by a job title's starting view
 * (OT-117) and by My categories (OT-118).
 */
export type NotifyLevel = Database['public']['Enums']['notify_level']

export type ViewSetting = { notify: NotifyLevel; shown: boolean }

/** Everyone starts here, and only what differs from it is stored. */
export const DEFAULT_VIEW: ViewSetting = { notify: 'all', shown: true }

const NOTIFY_OPTIONS: { value: NotifyLevel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'urgent', label: 'Urgent only' },
  { value: 'off', label: 'Off' },
]

const SHOW_OPTIONS: { value: 'shown' | 'hidden'; label: string }[] = [
  { value: 'shown', label: 'Shown' },
  { value: 'hidden', label: 'Hidden' },
]

/** A row's one-line summary: "Notify all · Shown", "Urgent only · Hidden"; only Shown or Hidden without Notify. */
export function viewSummary(v: ViewSetting, withNotify = true) {
  if (!withNotify) return v.shown ? 'Shown' : 'Hidden'
  const notify = v.notify === 'all' ? 'Notify all' : v.notify === 'urgent' ? 'Urgent only' : 'Notify off'
  return `${notify} · ${v.shown ? 'Shown' : 'Hidden'}`
}

export function ViewSettingFields({
  label,
  value,
  onChange,
  withNotify = true,
}: {
  /** What the settings are for, read with each control: "Front of House". */
  label: string
  value: ViewSetting
  onChange: (next: ViewSetting) => void
  /** False leaves out Notify me, for someone the shared pool doesn't reach (My categories). */
  withNotify?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      {withNotify && (
        <>
          <span className="text-12 font-semibold text-text-secondary">Notify me</span>
          <Segmented
            size="sm"
            label={`${label}: notify me`}
            value={value.notify}
            options={NOTIFY_OPTIONS}
            onChange={(notify) => onChange({ ...value, notify })}
          />
        </>
      )}
      <span className={`${withNotify ? 'pt-1 ' : ''}text-12 font-semibold text-text-secondary`}>Show on my lists</span>
      <Segmented
        size="sm"
        label={`${label}: show on my lists`}
        value={value.shown ? 'shown' : 'hidden'}
        options={SHOW_OPTIONS}
        onChange={(v) => onChange({ ...value, shown: v === 'shown' })}
      />
    </div>
  )
}
