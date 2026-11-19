import { useState, type ReactNode } from 'react'
import { AREAS, AREA_LABEL } from '../../app/areas'
import { Button } from '../../components/Button'
import { Input, Select, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { ReorderList } from '../../components/ReorderList'
import { Sheet } from '../../components/Sheet'
import type { MyCategory } from '../mycategories/useMyCategories'
import { isVideoUrl } from '../../lib/words'
import type { Area, EditorItem, EditorSection } from './useChecklistEditor'

/**
 * The checklist editor's sheets (OT-136; no board draws them, so they follow Categories'):
 * each saves through a checked, logged function. Off and on are always there; Delete only
 * for what has no history, after a confirm step that says it is permanent. The screen keys
 * each sheet per opening, so it starts from what it edits.
 */

type Common = {
  open: boolean
  onOpenChange: (open: boolean) => void
  saving: boolean
  error: unknown
}

function Failed({ error }: { error: unknown }) {
  if (!error) return null
  const code = (error as { code?: string }).code
  return (
    <ErrorBanner title="Couldn't save that.">
      {code === '23505'
        ? 'This checklist already has a section by that name.'
        : code === '40001'
          ? 'Someone changed this checklist meanwhile. Close this to see the newest version.'
          : code === '23514'
            ? 'Check the name and the video link, which must be a web address.'
            : 'Check your connection and try again.'}
    </ErrorBanner>
  )
}

/** Turn off or on, and Delete for something with no history, with its confirm step. */
function OffAndDelete({
  active,
  what,
  deletable,
  saving,
  onActive,
  onDelete,
  children,
}: {
  active: boolean
  what: string
  deletable: boolean
  saving: boolean
  onActive: (active: boolean) => void
  onDelete: () => void
  children: (confirm: () => void) => ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div className="flex flex-col gap-2.5 rounded-input bg-surface px-3.5 py-3">
        <span className="text-14 leading-[1.5]">
          Delete {what}? <b>This is permanent and cannot be undone.</b>
        </span>
        <Button variant="danger" loading={saving} onClick={onDelete}>
          Delete
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    )
  }
  return (
    <>
      <Button variant="secondary" disabled={saving} onClick={() => onActive(!active)}>
        {active ? 'Turn off' : 'Turn on'}
      </Button>
      {deletable
        ? children(() => setConfirming(true))
        : active && (
            <span className="text-13 text-text-secondary">
              A walkthrough has had this, so it stays on the record. Turned off, it goes on no new walkthrough.
            </span>
          )}
    </>
  )
}

const DeleteButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <Button variant="ghost" className="text-danger" onClick={onClick}>
    {label}
  </Button>
)

/** The checklist's name, its line ("A closer look") and short name ("BOH + FOH"). */
export function ChecklistDetailsSheet({
  checklist,
  deletable,
  onSave,
  onActive,
  onDelete,
  ...c
}: Common & {
  checklist: { name: string; description: string | null; short_name: string | null; active: boolean }
  deletable: boolean
  onSave: (v: { name: string; description: string; shortName: string }) => void
  onActive: (active: boolean) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(checklist.name)
  const [description, setDescription] = useState(checklist.description ?? '')
  const [shortName, setShortName] = useState(checklist.short_name ?? '')
  const [tried, setTried] = useState(false)
  return (
    <Sheet open={c.open} onOpenChange={c.onOpenChange} title="Checklist">
      <Input
        label="Name"
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={tried && !name.trim() ? 'Give the checklist a name.' : undefined}
      />
      <Input
        label="Line under it"
        optional
        maxLength={60}
        placeholder="e.g. A closer look"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        label="Short name"
        optional
        hint="On the year’s preview, e.g. BOH + FOH"
        maxLength={20}
        value={shortName}
        onChange={(e) => setShortName(e.target.value)}
      />
      <Failed error={c.error} />
      <Button
        loading={c.saving}
        onClick={() => {
          setTried(true)
          if (name.trim()) onSave({ name, description, shortName })
        }}
      >
        Save
      </Button>
      <OffAndDelete
        active={checklist.active}
        what={`“${checklist.name}”`}
        deletable={deletable}
        saving={c.saving}
        onActive={onActive}
        onDelete={onDelete}
      >
        {(confirm) => <DeleteButton onClick={confirm} label="Delete checklist" />}
      </OffAndDelete>
    </Sheet>
  )
}

/**
 * A section: its name, short name and area. The area is needed (OT-141), since a ticket from
 * an item with no category takes it; a section saved before then may have none, and keeps
 * none until it is edited here.
 */
export function SectionSheet({
  section,
  deletable,
  onSave,
  onActive,
  onDelete,
  ...c
}: Common & {
  section: EditorSection | null
  deletable: boolean
  onSave: (v: { name: string; shortName: string; area: Area }) => void
  onActive: (active: boolean) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(section?.name ?? '')
  const [shortName, setShortName] = useState(section?.short_name ?? '')
  const [area, setArea] = useState<string>(section?.area ?? '')
  const [tried, setTried] = useState(false)
  return (
    <Sheet open={c.open} onOpenChange={c.onOpenChange} title={section ? 'Section' : 'Add section'}>
      <Input
        label="Name"
        maxLength={60}
        placeholder="e.g. Kitchen"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={tried && !name.trim() ? 'Give the section a name.' : undefined}
      />
      <Input
        label="Short name"
        optional
        hint="Where an item’s place is named, e.g. BOH"
        maxLength={12}
        value={shortName}
        onChange={(e) => setShortName(e.target.value)}
      />
      <Select
        label="Area"
        hint="A ticket from an item with no category goes to this area."
        value={area}
        onChange={(e) => setArea(e.target.value)}
        error={tried && !area ? 'Pick the section’s area.' : undefined}
      >
        <option value="" disabled>
          Pick an area
        </option>
        {AREAS.map((a) => (
          <option key={a} value={a}>
            {AREA_LABEL[a]}
          </option>
        ))}
      </Select>
      <Failed error={c.error} />
      <Button
        loading={c.saving}
        onClick={() => {
          setTried(true)
          if (name.trim() && area) onSave({ name, shortName, area: area as Area })
        }}
      >
        {section ? 'Save' : 'Add section'}
      </Button>
      {section && (
        <OffAndDelete
          active={section.active}
          what={`the section “${section.name}”`}
          deletable={deletable}
          saving={c.saving}
          onActive={onActive}
          onDelete={onDelete}
        >
          {(confirm) => <DeleteButton onClick={confirm} label="Delete section" />}
        </OffAndDelete>
      )}
    </Sheet>
  )
}

/** An item: its section and group, title, directions, how-to video link and category. */
export function ItemSheet({
  item,
  deletable,
  sectionId,
  sections,
  groups,
  categories,
  onSave,
  onActive,
  onDelete,
  ...c
}: Common & {
  item: EditorItem | null
  /** No walkthrough has had it, nor what it was copied from. */
  deletable: boolean
  sectionId: string
  sections: EditorSection[]
  groups: string[]
  categories: MyCategory[]
  onSave: (v: {
    section: string
    group: string
    title: string
    directions: string
    videoUrl: string
    category: string | null
  }) => void
  onActive: (active: boolean) => void
  onDelete: () => void
}) {
  const [section, setSection] = useState(item?.section_id ?? sectionId)
  const [group, setGroup] = useState(item?.group_name ?? groups[groups.length - 1] ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [directions, setDirections] = useState(item?.directions ?? '')
  const [videoUrl, setVideoUrl] = useState(item?.video_url ?? '')
  const [category, setCategory] = useState(item?.category_id ?? '')
  const [tried, setTried] = useState(false)
  const badLink = videoUrl.trim() !== '' && !isVideoUrl(videoUrl.trim())
  return (
    <Sheet open={c.open} onOpenChange={c.onOpenChange} title={item ? 'Item' : 'Add item'}>
      <Select label="Section" value={section} onChange={(e) => setSection(e.target.value)}>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Input
        label="Group"
        maxLength={60}
        list="checklist-groups"
        placeholder="e.g. Electrical"
        value={group}
        onChange={(e) => setGroup(e.target.value)}
        error={tried && !group.trim() ? 'Name the group it goes under.' : undefined}
      />
      <datalist id="checklist-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <Input
        label="Item"
        maxLength={140}
        placeholder="e.g. Outlets"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={tried && !title.trim() ? 'Say what to check.' : undefined}
      />
      <Textarea
        label="Directions"
        optional
        rows={3}
        maxLength={2000}
        placeholder="What to look for, and when to submit a ticket"
        value={directions}
        onChange={(e) => setDirections(e.target.value)}
      />
      <Input
        label="How-to video link"
        optional
        type="url"
        inputMode="url"
        maxLength={500}
        placeholder="https://youtube.com/…"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        error={tried && badLink ? 'Use a web address that starts with https://' : undefined}
      />
      <Select
        label="Category"
        optional
        hint="A ticket from this item is filed under it; without one, the manager picks"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="">None</option>
        {AREAS.map((a) => (
          <optgroup key={a} label={AREA_LABEL[a]}>
            {categories
              .filter((x) => x.area === a && (x.active || x.id === item?.category_id))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
      <Failed error={c.error} />
      <Button
        loading={c.saving}
        onClick={() => {
          setTried(true)
          if (title.trim() && group.trim() && !badLink)
            onSave({ section, group, title, directions, videoUrl, category: category || null })
        }}
      >
        {item ? 'Save' : 'Add item'}
      </Button>
      {item && (
        <OffAndDelete
          active={item.active}
          what={`“${item.title}”`}
          deletable={deletable}
          saving={c.saving}
          onActive={onActive}
          onDelete={onDelete}
        >
          {(confirm) => <DeleteButton onClick={confirm} label="Delete item" />}
        </OffAndDelete>
      )}
    </Sheet>
  )
}

/** A group's name, on every item under it. */
export function GroupSheet({ name, onSave, ...c }: Common & { name: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name)
  return (
    <Sheet open={c.open} onOpenChange={c.onOpenChange} title="Rename group">
      <Input label="Group" maxLength={60} value={value} onChange={(e) => setValue(e.target.value)} />
      <Failed error={c.error} />
      <Button loading={c.saving} disabled={!value.trim()} onClick={() => onSave(value)}>
        Save
      </Button>
    </Sheet>
  )
}

/** Put sections, groups or items in order by dragging, then Save. */
export function OrderSheet({
  title,
  items,
  onSave,
  ...c
}: Common & {
  title: string
  items: { id: string; name: string; detail?: string }[]
  onSave: (ids: string[]) => void
}) {
  const [ids, setIds] = useState(items.map((i) => i.id))
  const byId = new Map(items.map((i) => [i.id, i]))
  return (
    <Sheet
      open={c.open}
      onOpenChange={c.onOpenChange}
      title={title}
      description="Drag the handles to change the order."
    >
      <ReorderList items={ids.map((id) => byId.get(id)!)} label={title} onChange={setIds} />
      <Failed error={c.error} />
      <Button loading={c.saving} onClick={() => onSave(ids)}>
        Save order
      </Button>
    </Sheet>
  )
}
