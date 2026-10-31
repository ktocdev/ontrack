import { useMemo, useState, type FormEvent } from 'react'
import { AccentPicker } from '../../components/AccentPicker'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Field'
import { RestaurantSquare } from '../../components/RestaurantName'
import { CloseBar, Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { Spinner } from '../../components/Skeleton'
import { isHex, normalizeHex, presetHex, PRESETS, reservedColors } from '../../lib/colors'
import { RestaurantError, type ManagerOption } from './useRestaurants'

/**
 * The form behind Add and Edit restaurant (design/screens/Admin-Add-Restaurant).
 * Name, address, optional phone, an accent color and, when adding, a manager.
 * Presets already in use are not offered; a custom color must be a hex code no
 * other restaurant uses. Two may look alike, but not match.
 */
export type RestaurantValues = { name: string; address: string; phone: string; color: string; managerId: string }

type Props = {
  title: string
  submitLabel: string
  /** Colors other restaurants use, in lower case. */
  taken: string[]
  /** What is being edited. Without it the first free preset is picked for a new restaurant. */
  initial?: { name: string; address: string; phone: string; color: string }
  /** Only Add restaurant picks a manager. */
  managers?: ManagerOption[]
  saving: boolean
  error: unknown
  clearError: () => void
  onSave: (values: RestaurantValues) => void
}

/** The screen while the list loads, before the form has anything to start from. */
export function RestaurantFormLoading({ title }: { title: string }) {
  return (
    <Screen>
      <CloseBar to="/admin/restaurants" title={title} />
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    </Screen>
  )
}

export function RestaurantForm({
  title,
  submitLabel,
  taken,
  initial,
  managers,
  saving,
  error,
  clearError,
  onSave,
}: Props) {
  const unavailable = useMemo(() => [...taken, ...reservedColors()], [taken])
  const options = useMemo(
    () =>
      PRESETS.map((p) => ({ value: presetHex(p.key), label: p.label }))
        .filter((o) => isHex(o.value) && !unavailable.includes(o.value))
        .map((o, i) => (i === 0 && !initial ? { ...o, label: `${o.label}, picked automatically` } : o)),
    [unavailable, initial],
  )
  const initialColor = initial?.color.toLowerCase()

  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [managerId, setManagerId] = useState('')
  const [choice, setChoice] = useState(() => {
    if (!initialColor) return options[0]?.value ?? 'custom'
    return options.some((o) => o.value === initialColor) ? initialColor : 'custom'
  })
  const [custom, setCustom] = useState(choice === 'custom' ? (initialColor ?? '') : '')

  const color = choice === 'custom' ? normalizeHex(custom) : choice
  const warning =
    choice !== 'custom'
      ? undefined
      : !isHex(color)
        ? custom.trim()
          ? 'Enter a 6-digit hex code, like #C2185B.'
          : undefined
        : unavailable.includes(color)
          ? 'That color is already in use. Pick another.'
          : undefined
  const ready = name.trim() !== '' && address.trim() !== '' && isHex(color) && !warning
  const inviting = managerId === 'invite'

  const fieldError = error instanceof RestaurantError ? error : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    onSave({ name: name.trim(), address: address.trim(), phone: phone.trim(), color, managerId })
  }

  const pickHint = options.length
    ? `${initial ? 'Tap another' : 'Picked for you. Tap another'} to change it, or pick a custom color. Colors other restaurants use aren’t offered.`
    : initial
      ? 'Every other preset color is in use. Pick a custom color to change it.'
      : 'Every preset color is in use. Pick a custom color.'

  return (
    <Screen>
      <CloseBar to="/admin/restaurants" title={title} />
      <form onSubmit={submit} onChange={clearError} className="flex min-h-0 flex-1 flex-col" noValidate>
        <ScreenBody className="gap-[18px] py-4">
          <Input
            label="Restaurant name"
            placeholder="e.g. Federale’s Logan Square"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldError?.field === 'name' ? fieldError.message : undefined}
          />
          <Input
            label="Address"
            placeholder="Street, city"
            autoComplete="street-address"
            maxLength={200}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Input
            label="Phone"
            optional
            type="tel"
            inputMode="tel"
            placeholder="(312) 555-0100"
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {managers && (
            <Select
              label="Manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              hint={
                inviting
                  ? 'After you save, you’ll go to Invite user with this restaurant already selected.'
                  : managerId
                    ? 'They get access to this restaurant when you save.'
                    : undefined
              }
            >
              <option value="">Choose a manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="invite">+ Invite a new manager</option>
            </Select>
          )}

          <AccentPicker
            label="Accent color"
            hint={pickHint}
            options={options}
            value={choice}
            onChange={(value) => {
              clearError()
              setChoice(value)
            }}
            custom={custom}
            onCustomChange={setCustom}
            warning={warning ?? (fieldError?.field === 'color' ? fieldError.message : undefined)}
          />

          <div className="-mt-2.5 flex flex-col gap-1.5 rounded-input border border-border bg-surface px-3.5 py-3">
            <span className="eyebrow text-11">Preview</span>
            <span className="flex items-center gap-2 text-15 font-semibold">
              <RestaurantSquare color={isHex(color) ? color : 'var(--text-secondary)'} size={12} />
              {name.trim() || 'Restaurant name'}
            </span>
          </div>
        </ScreenBody>

        <ScreenFooter>
          {fieldError?.field === 'form' && (
            <span role="alert" className="text-13 font-semibold text-danger">
              {fieldError.message}
            </span>
          )}
          <Button type="submit" loading={saving} disabled={!ready}>
            {submitLabel}
          </Button>
        </ScreenFooter>
      </form>
    </Screen>
  )
}
