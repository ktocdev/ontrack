import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AccentPicker } from '../../components/AccentPicker'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Field'
import { RestaurantSquare } from '../../components/RestaurantName'
import { CloseBar, Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { isHex, normalizeHex, presetHex, PRESETS, reservedColors, tooClose } from '../../lib/colors'
import { AddRestaurantError, useAddRestaurant, useAdminRestaurants } from './useRestaurants'

/**
 * Admin · Add restaurant (design/screens/Admin-Add-Restaurant). Name,
 * address, optional phone, manager, and an accent color: the first preset no
 * restaurant uses is picked for you; presets already in use are not offered;
 * a custom color must be a hex code not too close to one in use. Saving gives
 * the manager access to the new restaurant. The board's "+ Invite a new
 * manager" option arrives with Invite user (OT-10).
 */
export function AddRestaurantScreen() {
  const { data, isPending } = useAdminRestaurants()
  if (isPending || !data) {
    return (
      <Screen>
        <CloseBar to="/admin/restaurants" title="Add restaurant" />
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      </Screen>
    )
  }
  return <AddRestaurantForm taken={data.restaurants.map((r) => r.color.toLowerCase())} managers={data.managers} />
}

function AddRestaurantForm({ taken, managers }: { taken: string[]; managers: { id: string; name: string }[] }) {
  const navigate = useNavigate()
  const toast = useToast()
  const add = useAddRestaurant()

  const unavailable = useMemo(() => [...taken, ...reservedColors()], [taken])
  const options = useMemo(
    () =>
      PRESETS.map((p) => ({ value: presetHex(p.key), label: p.label }))
        .filter((o) => isHex(o.value) && !unavailable.includes(o.value))
        .map((o, i) => (i === 0 ? { ...o, label: `${o.label}, picked automatically` } : o)),
    [unavailable],
  )

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [managerId, setManagerId] = useState('')
  const [choice, setChoice] = useState(options[0]?.value ?? 'custom')
  const [custom, setCustom] = useState('')

  const color = choice === 'custom' ? normalizeHex(custom) : choice
  const warning =
    choice !== 'custom'
      ? undefined
      : !isHex(color)
        ? 'Enter a 6-digit hex code, like #C2185B.'
        : tooClose(color, unavailable)
          ? 'Looks a lot like a color already in use. Pick something more distinct.'
          : undefined
  const ready = name.trim() !== '' && address.trim() !== '' && isHex(color) && !warning

  const fieldError = add.error instanceof AddRestaurantError ? add.error : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    add.mutate(
      { name: name.trim(), address: address.trim(), phone: phone.trim(), color, managerId: managerId || null },
      {
        onSuccess: () => {
          toast.show(`${name.trim()} added.`)
          navigate('/admin/restaurants')
        },
      },
    )
  }

  return (
    <Screen>
      <CloseBar to="/admin/restaurants" title="Add restaurant" />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
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
          <Select
            label="Manager"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            hint={managerId ? 'They get access to this restaurant when you save.' : undefined}
          >
            <option value="">Choose a manager</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>

          <AccentPicker
            label="Accent color"
            hint="Picked for you. Tap another to change it, or pick a custom color. Colors other restaurants use aren’t offered."
            options={options}
            value={choice}
            onChange={setChoice}
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
          <Button type="submit" loading={add.isPending} disabled={!ready}>
            Save restaurant
          </Button>
        </ScreenFooter>
      </form>
    </Screen>
  )
}
