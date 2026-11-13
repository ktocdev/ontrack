import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { Button, ButtonLink } from '../../components/Button'
import { DisclosureList } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { AllRestaurantsSquare, RestaurantName, RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenEmpty, ScreenHeader } from '../../components/Screen'
import { FlagChip, ProgressBar, WalkthroughCardSkeleton, WalkthroughSectionRow } from '../../components/Walkthrough'
import { IconClipboardCheck, IconWarning } from '../../components/icons'
import type { SignedIn } from '../../auth/types'
import { useWalkthroughHome, type HomeWalkthrough } from './useWalkthroughHome'
import { checklistTitle, dueDate, monthName, monthShort, onDay, pastFlag } from './walkthrough'

type Restaurant = SignedIn['restaurants'][number]

/**
 * Manager · Walkthrough (design/screens/WT-Home, WT-Home-Done). Each restaurant's newest
 * walkthrough as a card: the month, the due date, the checklist's sections as its title,
 * the bar split into Good, in-house and tickets, then a row for each section and the
 * quarter's tasks with their flags. Review & submit is an outline button until every
 * check is done, then the primary one. A walkthrough is shared by everyone at the
 * restaurant, so the card says who started it when that wasn't you, and who submitted
 * it once it is in. Past walkthroughs sit closed under the card. Before a restaurant's
 * first walkthrough opens there is an empty state, which no board draws. A manager with
 * more than one restaurant gets a card for each, named. Under View as, nothing opens.
 */
export function WalkthroughHomeScreen() {
  const { restaurants, user, viewingAs } = useUser()
  const { data, isPending, isError, refetch } = useWalkthroughHome(restaurants.map((r) => r.id))
  const only = restaurants.length === 1 ? restaurants[0] : undefined
  const byId = new Map(restaurants.map((r) => [r.id, r]))

  return (
    <Screen>
      <ScreenHeader
        title="Walkthrough"
        topLeft={
          only ? (
            <RestaurantName name={only.name} color={only.color} />
          ) : (
            <span className="flex items-center gap-1.5 text-14 font-semibold">
              <AllRestaurantsSquare colors={restaurants.map((r) => r.color)} />
              {restaurants.length} restaurants
            </span>
          )
        }
        topRight={<ProfileLink />}
      />

      {isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load the walkthrough"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : isPending ? (
        <ScreenBody className="gap-3 pb-4" aria-busy="true" aria-label="Loading the walkthrough">
          <WalkthroughCardSkeleton />
        </ScreenBody>
      ) : data.current.length === 0 && data.past.length === 0 ? (
        <ScreenEmpty>
          <EmptyState
            titleSize={20}
            icon={<IconClipboardCheck size={30} />}
            title="No walkthrough yet"
            body="Each month's walkthrough opens on the 1st and shows here, with its checklist and due date."
          />
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-3 pb-4">
          {data.current.map((w) => (
            <ThisMonth
              key={w.id}
              walkthrough={w}
              restaurant={only ? undefined : byId.get(w.restaurant_id)}
              me={user.id}
              readOnly={!!viewingAs}
            />
          ))}
          {data.past.length > 0 && (
            <DisclosureList label="Past walkthroughs" heading="Past walkthroughs" variant="chevron">
              {data.past.map((w) => (
                <PastRow key={w.id} walkthrough={w} restaurant={only ? undefined : byId.get(w.restaurant_id)} />
              ))}
            </DisclosureList>
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}

function ThisMonth({
  walkthrough: w,
  restaurant,
  me,
  readOnly,
}: {
  walkthrough: HomeWalkthrough
  restaurant?: Restaurant
  me: string
  readOnly: boolean
}) {
  const p = w.progress
  const allDone = p.total > 0 && p.done >= p.total
  const submitted = w.status === 'submitted'
  const startedBy = w.started_by && w.started_by !== me ? w.starter?.full_name : undefined
  const base = `/walkthrough/${w.id}`

  return (
    <section
      aria-label={`${monthName(w.period)} walkthrough${restaurant ? ` at ${restaurant.name}` : ''}`}
      className="flex-none overflow-hidden rounded-card border border-border bg-surface"
    >
      <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5">
        {restaurant && <RestaurantName name={restaurant.name} color={restaurant.color} />}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-13 font-bold text-brand">{monthName(w.period)}</span>
          <span className="text-12 font-semibold text-status-waiting-text">Due {dueDate(w.due_on)}</span>
        </div>
        <h2 className="text-17 font-bold text-text">{checklistTitle(p.parts)}</h2>
        <ProgressBar
          good={p.good}
          inhouse={p.inhouse}
          tickets={p.ticketItems}
          total={p.total}
          label={`${p.done} of ${p.total} checks done`}
        />
        <div className="flex justify-between gap-2 text-12 text-text-secondary">
          <span>
            <b className="font-bold text-text">
              {p.done} of {p.total}
            </b>{' '}
            done{allDone && !submitted ? ' · ready to submit' : ''}
          </span>
          {!submitted && <span>Saved automatically</span>}
        </div>
        {startedBy && !submitted && <span className="-mt-1 text-12 text-text-muted">{startedBy} started it</span>}
      </div>
      <div className="[&>*:last-child]:border-b-0">
        {p.parts.map((part) => (
          <WalkthroughSectionRow
            key={part.key}
            to={readOnly ? undefined : `${base}/${part.key}`}
            name={part.name}
            done={part.done}
            total={part.total}
            tickets={part.tickets}
            fixes={part.fixes}
          />
        ))}
      </div>
      {submitted ? (
        <p className="border-t border-border px-4 py-3.5 text-13 text-text-secondary">
          Submitted{w.submitted_at ? ` ${onDay(w.submitted_at)}` : ''}
          {w.submitter ? ` by ${w.submitter.full_name}` : ''}
        </p>
      ) : (
        !readOnly && (
          <div className="px-4 pb-4 pt-1">
            <ButtonLink to={`${base}/review`} variant={allDone ? 'medium' : 'outline'} className="w-full">
              Review &amp; submit
            </ButtonLink>
          </div>
        )
      )}
    </section>
  )
}

function PastRow({ walkthrough: w, restaurant }: { walkthrough: HomeWalkthrough; restaurant?: Restaurant }) {
  const flag = pastFlag(w.status, w.progress)
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3.5 text-13 first:border-t-0">
      <span className="w-9 flex-none font-bold text-text">{monthShort(w.period)}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-text-body">
        {restaurant && <RestaurantSquare color={restaurant.color} />}
        <span className="truncate">{restaurant ? restaurant.name : checklistTitle(w.progress.parts, true)}</span>
      </span>
      <FlagChip tone={flag.tone}>{flag.label}</FlagChip>
    </div>
  )
}
