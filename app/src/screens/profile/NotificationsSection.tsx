import { Button } from '../../components/Button'
import { ListCard, ListRow } from '../../components/Card'
import { SectionLabel } from '../../components/Screen'
import { Switch } from '../../components/Switch'
import { useToast } from '../../components/Toast'
import { useUser } from '../../auth/context'
import { pushSupport } from '../../pwa/push'
import { kindsFor, useNotificationPrefs, usePushDevice, useTestPush } from './useNotifications'

/**
 * Profile · Notifications, which no board draws. A switch for push on this device, a test,
 * one for email, and one per kind of notification, which covers both. Email and the kinds
 * belong to the person, on all their devices. Which kinds show follows who is sent what.
 * Someone who only wants email leaves push off. They save as they change. Push comes back
 * on after signing back in (pwa/push.ts). If the device can't be read, the row says so
 * rather than Off.
 */
const WHY_NOT = {
  'not-configured': 'Notifications aren’t set up for this app yet.',
  'install-first': 'On an iPhone, add OnTrack to your Home Screen first, then open it from there.',
  unsupported: 'This browser can’t receive notifications.',
  blocked: 'Notifications are blocked. Allow them for OnTrack in this device’s settings.',
}

export function NotificationsSection() {
  const { user } = useUser()
  const toast = useToast()
  const { device, on, off } = usePushDevice()
  const test = useTestPush()
  const { prefs, set } = useNotificationPrefs()
  const support = pushSupport()
  const kinds = kindsFor(user.role)
  const isOn = !!device.data
  const busy = on.isPending || off.isPending
  const emailOn = !prefs.data?.has('email')
  const offLine = kinds.length && emailOn ? 'Off. You’ll still get email.' : 'Off'
  const deviceLine = device.isError
    ? 'Couldn’t check this device. Close and reopen the app to try again.'
    : device.isPending
      ? 'Checking…'
      : isOn
        ? 'On'
        : offLine

  const changeDevice = (next: boolean) => {
    if (next) {
      on.mutate(undefined, {
        onSuccess: (granted) => {
          if (granted) toast.show('Notifications are on for this device.')
          else toast.show('Notifications weren’t allowed, so they stay off.')
        },
        onError: () => toast.show('Couldn’t turn on notifications. Try again.'),
      })
    } else {
      off.mutate(undefined, { onError: () => toast.show('Couldn’t turn off notifications. Try again.') })
    }
  }

  const sendTest = () =>
    test.mutate(undefined, {
      onSuccess: (result) =>
        toast.show(
          result === 'gone'
            ? 'Couldn’t reach this device. Turn notifications off and on again.'
            : 'Test sent. It should arrive in a moment.',
        ),
      onError: () => toast.show('Couldn’t send a test. Check your connection and try again.'),
    })

  return (
    <>
      <SectionLabel className="-mb-0.5">Notifications</SectionLabel>
      <ListCard>
        <ListRow
          title="Push notifications on this device"
          subtitle={support === 'ready' ? deviceLine : WHY_NOT[support]}
          trailing={
            support === 'ready' ? (
              <Switch
                label="Push notifications on this device"
                checked={isOn}
                disabled={busy || device.isPending || device.isError}
                onCheckedChange={changeDevice}
              />
            ) : undefined
          }
        />
        {support === 'ready' && isOn && (
          <ListRow
            title="Send a test"
            subtitle="To check this device gets them"
            trailing={
              <Button variant="ghost" loading={test.isPending} onClick={sendTest}>
                Send
              </Button>
            }
          />
        )}
        {kinds.length > 0 && (
          <ListRow
            title="Email"
            subtitle="The ones below, by email as well"
            trailing={
              <Switch
                label="Email notifications"
                checked={emailOn}
                disabled={prefs.isPending || set.isPending}
                onCheckedChange={(enabled) =>
                  set.mutate(
                    { kind: 'email', enabled },
                    { onError: () => toast.show('Couldn’t save that. Try again.') },
                  )
                }
              />
            }
          />
        )}
        {kinds.map(({ kind, title, subtitle }) => (
          <ListRow
            key={kind}
            title={title}
            subtitle={subtitle}
            trailing={
              <Switch
                label={title}
                checked={!prefs.data?.has(kind)}
                disabled={prefs.isPending || set.isPending}
                onCheckedChange={(enabled) =>
                  set.mutate({ kind, enabled }, { onError: () => toast.show('Couldn’t save that. Try again.') })
                }
              />
            }
          />
        ))}
      </ListCard>
    </>
  )
}
