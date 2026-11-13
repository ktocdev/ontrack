import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import {
  CheckChoice,
  ChecklistEntries,
  ChecklistEntry,
  ChecklistGroup,
  ChecklistHelp,
  ChecklistItem,
  InlineFix,
} from '../../components/Checklist'
import { BackBar, Screen, ScreenBody, UnderlineTabs } from '../../components/Screen'
import { GroupedListSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { firstOpen, groupsOf, openAfter, type ChecklistGroup as Group } from './checklist'
import { goodRefusal, useAddFix, useChecklist, useSetGood } from './useChecklist'
import { monthName } from './walkthrough'

/**
 * Manager · Walkthrough checklist (design/screens/WT-Checklist). One section of the month's
 * walkthrough: the tabs between sections, Help, and the section's groups as cards. Each
 * item has Good, In-house and Ticket; every tap saves at once. Good is hidden while the
 * item has a fix or ticket still open, as the database refuses it then. In-house opens a
 * field under the item; Ticket opens the quick ticket sheet (OT-106). What was made from
 * an item is listed under it. When a group fills, it closes and the next one opens. A
 * submitted walkthrough, or one seen under View as, shows its marks and changes nothing.
 */
export function ChecklistScreen() {
  const { id = '', section = '' } = useParams()
  const { data, isPending, isError } = useChecklist(id)
  const { viewingAs } = useUser()

  if (isPending) {
    return (
      <Screen>
        <BackBar to="/walkthrough" label="Back to walkthrough" />
        <ScreenBody className="pb-4">
          <GroupedListSkeleton />
        </ScreenBody>
      </Screen>
    )
  }
  if (isError || !data) return <NotFoundScreen />
  const part = data.progress.parts.find((p) => p.key === section)
  if (!part || section === 'quarterly') return <NotFoundScreen />

  const w = data.walkthrough
  const readOnly = !!viewingAs || w.status !== 'open'
  const base = `/walkthrough/${w.id}`

  return (
    <Screen>
      <BackBar
        to="/walkthrough"
        label="Back to walkthrough"
        roomy
        action={
          <span aria-live="polite" className="flex-none pl-2 text-13 font-bold text-text">
            {part.done}/{part.total}
          </span>
        }
      >
        <span className="block text-12 text-text-secondary">
          {monthName(w.period)} walkthrough · {w.restaurantName}
        </span>
        <h1 className="font-display text-20 font-bold text-text">{part.name}</h1>
      </BackBar>
      <div className="mx-screen mt-2.5 h-1.5 flex-none overflow-hidden rounded-[3px] bg-surface-sunken">
        <div
          className="h-full bg-progress-good"
          style={{ width: `${part.total ? Math.round((part.done / part.total) * 100) : 0}%` }}
        />
      </div>
      <UnderlineTabs
        label="Walkthrough parts"
        className="mx-screen mt-1.5 flex-none"
        items={data.progress.parts.map((p) => ({
          to: `${base}/${p.key}`,
          label: p.key === 'quarterly' ? `${p.shortName} tasks` : p.shortName,
        }))}
      />
      <Section
        key={section}
        sectionId={section}
        walkthroughId={w.id}
        data={data}
        readOnly={readOnly}
        linksOff={!!viewingAs}
      />
    </Screen>
  )
}

type Data = NonNullable<ReturnType<typeof useChecklist>['data']>

function Section({
  sectionId,
  walkthroughId,
  data,
  readOnly,
  linksOff,
}: {
  sectionId: string
  walkthroughId: string
  data: Data
  readOnly: boolean
  linksOff: boolean
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const setGood = useSetGood(walkthroughId)
  const addFix = useAddFix(walkthroughId)
  const [drafting, setDrafting] = useState<string | null>(null)

  const groups = useMemo(
    () => groupsOf(sectionId, data.items, data.checks, data.fixes, data.tickets),
    [sectionId, data.items, data.checks, data.fixes, data.tickets],
  )
  // When a tap fills a group, it closes and the next opens (worked out as the data changes).
  const [seen, setSeen] = useState<Group[]>(groups)
  const [open, setOpen] = useState(() => firstOpen(groups))
  if (seen !== groups) {
    setSeen(groups)
    setOpen(openAfter(seen, groups, open))
  }

  const toggle = (name: string) =>
    setOpen((o) => {
      const next = new Set(o)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <ScreenBody className="gap-2.5 pb-5 pt-3">
      <ChecklistHelp />
      {groups.map((g) => (
        <ChecklistGroup
          key={g.name}
          name={g.name}
          done={g.done}
          total={g.total}
          open={open.has(g.name)}
          onToggle={() => toggle(g.name)}
        >
          {g.items.map((it) => {
            const records = it.fixes.length + it.tickets.length
            const isDrafting = drafting === it.id
            return (
              <ChecklistItem
                key={it.id}
                name={it.title}
                choices={
                  <>
                    {!it.open && (
                      <CheckChoice
                        tone="good"
                        lit={it.good}
                        aria-pressed={it.good}
                        disabled={readOnly}
                        onClick={() =>
                          setGood.mutate(
                            { itemId: it.id, good: !it.good },
                            { onError: (e) => toast.show(goodRefusal(e)) },
                          )
                        }
                      >
                        Good
                      </CheckChoice>
                    )}
                    <CheckChoice
                      tone="inhouse"
                      lit={it.fixes.length > 0}
                      disabled={readOnly}
                      aria-label={
                        it.fixes.length
                          ? `Add another in-house fix for ${it.title} (${it.fixes.length} so far)`
                          : `Add in-house fix for ${it.title}`
                      }
                      onClick={() => setDrafting(it.id)}
                    >
                      In-house
                    </CheckChoice>
                    <CheckChoice
                      tone="ticket"
                      lit={it.tickets.length > 0}
                      disabled={readOnly}
                      aria-label={
                        it.tickets.length
                          ? `Add another ticket for ${it.title} (${it.tickets.length} so far)`
                          : `Create ticket for ${it.title}`
                      }
                      onClick={() => navigate(`/walkthrough/${walkthroughId}/ticket/${it.id}`)}
                    >
                      Ticket
                    </CheckChoice>
                  </>
                }
              >
                {(records > 0 || isDrafting) && (
                  <ChecklistEntries>
                    {it.fixes.map((f) => (
                      <ChecklistEntry
                        key={f.id}
                        kind="fix"
                        done={!!f.done_at}
                        to={linksOff ? undefined : '/tickets/in-house'}
                      >
                        {f.title}
                      </ChecklistEntry>
                    ))}
                    {it.tickets.map((t) => (
                      <ChecklistEntry
                        key={t.id}
                        kind="ticket"
                        label={t.display_id ?? ''}
                        urgent={t.urgency === 'urgent'}
                        done={t.status === 'closed'}
                        to={linksOff ? undefined : `/tickets/${t.id}`}
                      >
                        {t.title}
                      </ChecklistEntry>
                    ))}
                    {isDrafting && !readOnly && (
                      <InlineFix
                        item={it.title}
                        saving={addFix.isPending}
                        onCancel={() => setDrafting(null)}
                        onAdd={(title) =>
                          addFix.mutate(
                            { itemId: it.id, title },
                            {
                              onSuccess: () => setDrafting(null),
                              onError: () => toast.show('Couldn’t add that fix. Check your connection and try again.'),
                            },
                          )
                        }
                      />
                    )}
                  </ChecklistEntries>
                )}
              </ChecklistItem>
            )
          })}
        </ChecklistGroup>
      ))}
    </ScreenBody>
  )
}
