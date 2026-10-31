import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { RadioRow } from '../../components/Card'
import { ChoiceChips } from '../../components/Chip'
import { Input, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { BackBar, Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { ReportSheet } from '../profile/ReportSheet'
import { AREA_LABEL } from './tickets'
import { useCreateTicket, useTicketForm, type Urgency } from './useCreateTicket'

/**
 * Manager · Create ticket: form (design/screens/Create-Form), with the failed save
 * from Error-Save-Failed: what was typed stays, a banner says so and the screen goes
 * back up to it. Equipment is what this restaurant has in this category, and tapping
 * the chosen unit again clears it. Add photo comes with OT-28.
 */
export function CreateFormScreen() {
  const { categoryId = '' } = useParams()
  const [params] = useSearchParams()
  const { user, restaurants } = useUser()
  const restaurant =
    restaurants.find((r) => r.id === params.get('restaurant')) ??
    restaurants.find((r) => r.id === user.home_restaurant_id) ??
    restaurants[0]
  const { data, isPending } = useTicketForm(categoryId, restaurant?.id)

  if (!restaurant || (data && !data.category)) return <NotFoundScreen />
  if (isPending || !data?.category) {
    return (
      <Screen className="items-center justify-center">
        <Spinner />
      </Screen>
    )
  }
  return (
    <CreateForm
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      category={data.category}
      equipment={data.equipment}
      backTo={`/tickets/new?area=${data.category.area}&restaurant=${restaurant.id}`}
    />
  )
}

function CreateForm({
  restaurantId,
  restaurantName,
  category,
  equipment,
  backTo,
}: {
  restaurantId: string
  restaurantName: string
  category: { id: string; name: string; area: 'foh' | 'boh' }
  equipment: { id: string; name: string; serial: string | null }[]
  backTo: string
}) {
  const { user } = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateTicket()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('normal')
  const [equipmentId, setEquipmentId] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const banner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (create.isError) banner.current?.scrollIntoView({ block: 'center' })
  }, [create.isError])

  const refused = (create.error as { code?: string } | null)?.code === '42501'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    create.mutate(
      {
        restaurantId,
        categoryId: category.id,
        equipmentId,
        title: title.trim(),
        description: description.trim(),
        urgency,
        createdBy: user.id,
      },
      {
        onSuccess: (ticket) => {
          toast.show(`${ticket.display_id} created.`)
          navigate('/tickets')
        },
      },
    )
  }

  return (
    <Screen>
      <BackBar to={backTo} label="Back to categories" bordered={false}>
        {AREA_LABEL[category.area]} › {category.name}
      </BackBar>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <ScreenBody className="gap-4 pb-4 pt-1">
          <h1 className="font-display text-26 font-bold tracking-[-0.02em]">New ticket</h1>
          {create.isError && (
            <div ref={banner} className="flex flex-none flex-col items-start gap-0.5">
              <ErrorBanner title="Couldn't save yet.">
                {refused
                  ? `Your account can't create tickets at ${restaurantName}. Ask your admin. `
                  : 'Check your connection and try again. '}
                Everything you entered is still here.
              </ErrorBanner>
              <Button type="button" variant="ghost" onClick={() => setReporting(true)}>
                Think this is wrong? Report a problem
              </Button>
            </div>
          )}
          <Input label="Title" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <ChoiceChips<Urgency>
            label="Urgency"
            value={urgency}
            onChange={setUrgency}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
          {equipment.length > 0 && (
            <div className="flex flex-none flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-13 font-semibold text-text-body">Attach equipment</span>
                <span className="text-12 text-text-muted">Optional</span>
              </div>
              <div
                role="radiogroup"
                aria-label="Equipment"
                className="overflow-hidden rounded-card border border-border bg-surface"
              >
                {equipment.map((e) => (
                  <RadioRow
                    key={e.id}
                    checked={equipmentId === e.id}
                    title={e.name}
                    subtitle={e.serial ? `SN ${e.serial}` : undefined}
                    onSelect={() => setEquipmentId(equipmentId === e.id ? null : e.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </ScreenBody>
        <ScreenFooter>
          <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
            Submit ticket
          </Button>
        </ScreenFooter>
      </form>
      <ReportSheet open={reporting} onOpenChange={setReporting} context="Creating a ticket" />
    </Screen>
  )
}
