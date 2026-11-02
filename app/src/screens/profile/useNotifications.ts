import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../../auth/context'
import { requireSupabase } from '../../lib/supabase'
import { deviceSubscription, turnOffPush, turnOnPush } from '../../pwa/push'
import type { AppRole } from '../../lib/supabase'

export type NotificationKind = 'new_ticket' | 'reopened' | 'status_change' | 'update'
type PrefKind = NotificationKind | 'email'

const KIND = {
  new_ticket: { title: 'New tickets', subtitle: 'When a ticket is created at your restaurants' },
  reopened: { title: 'Reopened tickets', subtitle: 'When a manager reopens a ticket' },
  status_change: { title: 'Status changes', subtitle: 'When the status changes on a ticket you opened or are on' },
  update: { title: 'Updates', subtitle: 'When someone posts on a ticket you opened or are on' },
} satisfies Record<NotificationKind, { title: string; subtitle: string }>

/** What each role is sent, which notification_recipients applies. Admin and leadership aren't sent anything yet. */
const KINDS_FOR: Record<AppRole, NotificationKind[]> = {
  ops: ['new_ticket', 'reopened', 'status_change', 'update'],
  manager: ['status_change', 'update'],
  admin: [],
  leadership: [],
}

export function kindsFor(role: AppRole) {
  return KINDS_FOR[role].map((kind) => ({ kind, ...KIND[kind] }))
}

/** Whether this device gets notifications, and turning that on and off. */
export function usePushDevice() {
  const queryClient = useQueryClient()
  const key = ['push-device']
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const device = useQuery({ queryKey: key, queryFn: deviceSubscription })
  const on = useMutation({ mutationFn: turnOnPush, onSettled: refresh })
  const off = useMutation({ mutationFn: turnOffPush, onSettled: refresh })
  return { device, on, off }
}

/** Sends a test to this device. 'gone' means the push service no longer knows it. */
export function useTestPush() {
  return useMutation({
    mutationFn: async () => {
      const subscription = await deviceSubscription()
      if (!subscription) throw new Error('no subscription')
      const { data, error } = await requireSupabase().functions.invoke<{ result: 'sent' | 'gone' }>('test-push', {
        body: { endpoint: subscription.endpoint },
      })
      if (error) throw error
      return data?.result
    },
  })
}

/** The kinds this person turned off. Everything else is on. */
export function useNotificationPrefs() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const key = ['notification-prefs', user.id]
  const prefs = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('notification_prefs').select('kind, enabled')
      if (error) throw error
      return new Set(data.filter((p) => !p.enabled).map((p) => p.kind))
    },
  })
  const set = useMutation({
    mutationFn: async ({ kind, enabled }: { kind: PrefKind; enabled: boolean }) => {
      const { error } = await requireSupabase()
        .from('notification_prefs')
        .upsert({ user_id: user.id, kind, enabled, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  return { prefs, set }
}
