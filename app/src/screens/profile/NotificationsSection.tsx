import { Button } from '../../components/Button'
import { ListCard, ListRow } from '../../components/Card'
import { SectionLabel } from '../../components/Screen'
import { Switch } from '../../components/Switch'
import { useToast } from '../../components/Toast'
import { useUser } from '../../auth/context'
import { pushSupport } from '../../pwa/push'
import { kindsFor, useNotificationPrefs, usePushDevice, useTestPush } from './useNotifications'

/**
 * Profile · Notifications, which no board draws. A switch for this device, a test, and a
 * switch per kind of notification for this person on all their devices. Which kinds show
 * follows who is sent what, and they save as they change.
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
          title="This device"
          subtitle={support === 'ready' ? (isOn ? 'On' : 'Off') : WHY_NOT[support]}
          trailing={
            support === 'ready' ? (
              <Switch
                label="Notifications on this device"
                checked={isOn}
                disabled={busy || device.isPending}
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
