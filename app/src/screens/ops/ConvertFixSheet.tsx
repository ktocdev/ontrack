import { useState } from 'react'
import { AREAS, AREA_LABEL, type Area } from '../../app/areas'
import { useRoleNames } from '../../auth/group'
import { Button } from '../../components/Button'
import { Select } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { Sheet } from '../../components/Sheet'
import { useAllCategories } from '../mycategories/useMyCategories'
import { useConvertFix } from '../tickets/useInHouse'

export type ConvertTarget = {
  id: string
  title: string
  /**
   * The fix's category or its item's. Without one, or with one turned off since, a task added
   * by hand asks for a category, and a walkthrough's fix becomes a ticket with none (OT-141).
   */
  knownCategory: string | null
  /** The fix's area, which a walkthrough's ticket with no category takes; else the sheet asks. */
  area: Area | null
  fromWalkthrough: boolean
}

/**
 * Convert to a ticket? (WT-Ops-Fix, OT-131): the confirm step before an in-house fix
 * becomes a ticket. The board's "unassigned" is left out, since nobody assigns tickets
 * (OT-48): it is a new ticket on the dashboard with nobody on it. The restaurant's
 * Reporters hear about it, by their My categories.
 */
export function ConvertFixSheet({
  fix,
  onClose,
  onConverted,
}: {
  fix: ConvertTarget | null
  onClose: () => void
  onConverted: (displayId: string | null, ticketId: string) => void
}) {
  const roles = useRoleNames()
  const convert = useConvertFix()
  const categories = useAllCategories()
  const [categoryId, setCategoryId] = useState('')
  const [area, setArea] = useState<Area | ''>('')
  const [missing, setMissing] = useState(false)
  // A turned-off category takes no new ticket, so a fix that still names one counts as none.
  const turnedOff = categories.data?.find((c) => c.id === fix?.knownCategory)?.active === false
  const noCategory = !!fix && (!fix.knownCategory || turnedOff)
  const needsCategory = noCategory && !fix.fromWalkthrough
  const needsArea = noCategory && fix.fromWalkthrough && !fix.area

  const close = (open: boolean) => {
    if (open) return
    setCategoryId('')
    setArea('')
    setMissing(false)
    convert.reset()
    onClose()
  }

  const confirm = () => {
    if (!fix) return
    if ((needsCategory && !categoryId) || (needsArea && !area)) {
      setMissing(true)
      return
    }
    convert.mutate(
      { id: fix.id, categoryId: needsCategory ? categoryId : null, area: needsArea ? area || null : null },
      {
        onSuccess: ({ displayId, ticketId }) => {
          close(false)
          onConverted(displayId, ticketId)
        },
      },
    )
  }

  return (
    <Sheet open={!!fix} onOpenChange={close} title="Convert to a ticket?">
      <div className="flex flex-col gap-2 text-14 leading-[1.5] text-text-body">
        <span>
          “{fix?.title}” becomes a ticket on your dashboard{fix?.fromWalkthrough ? ', tagged Walkthrough' : ''}, with
          nobody on it yet.
        </span>
        <span>
          It moves off the restaurant’s in-house list, and its {roles.name('manager', 'managers')} get a notification.
        </span>
      </div>
      {needsCategory && (
        <Select
          label="Category"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setMissing(false)
          }}
          error={missing ? 'Pick a category for the ticket.' : undefined}
        >
          <option value="">Choose…</option>
          {AREAS.map((area) => (
            <optgroup key={area} label={AREA_LABEL[area]}>
              {(categories.data ?? [])
                .filter((c) => c.area === area && c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      )}
      {needsArea && (
        <Select
          label="Area"
          hint="This fix has no area to give the ticket, so pick where it belongs."
          value={area}
          onChange={(e) => {
            setArea(e.target.value as Area)
            setMissing(false)
          }}
          error={missing ? 'Pick an area for the ticket.' : undefined}
        >
          <option value="">Choose…</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {AREA_LABEL[a]}
            </option>
          ))}
        </Select>
      )}
      {convert.isError && (
        <ErrorBanner title="Couldn't convert this fix.">
          {(convert.error as { code?: string } | null)?.code === '22023'
            ? 'It was fixed or converted in the meantime. Close this to see where it stands.'
            : 'Check your connection and try again.'}
        </ErrorBanner>
      )}
      <Button loading={convert.isPending} onClick={confirm}>
        Convert to ticket
      </Button>
      <Button variant="secondary" onClick={() => close(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}
