import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Rereads tickets as soon as one changes, so lists and an open ticket keep up on their own.
 * Realtime only sends the signal, RLS decides who gets it, and each screen's usual query
 * still decides what it shows. If the connection drops, the screens' own rereading carries on.
 * A burst of changes, like posting with photos, is one reread.
 */
const SETTLE_MS = 250

export function LiveTickets() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (__E2E_MOCK__ || !supabase) return
    const client = supabase
    let timer: number | undefined
    const reread = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        for (const queryKey of [['tickets'], ['ticket'], ['ops-ticket']]) {
          void queryClient.invalidateQueries({ queryKey })
        }
      }, SETTLE_MS)
    }
    const channel = client
      .channel('tickets-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, reread)
      .subscribe()
    return () => {
      window.clearTimeout(timer)
      void client.removeChannel(channel)
    }
  }, [queryClient])

  return null
}
