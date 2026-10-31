import { supabase } from '../lib/supabase'

/**
 * What 2-step verification is owed, from the database (two_step_status), because a
 * session that owes a step cannot read even its own profile. `gate` is what stops
 * the app: 'challenge' for a code, 'setup' to add an authenticator. "Don't ask again
 * on this phone" is a token kept here, and the database only takes it from a session
 * signed in with the password, so a reset link can't spend it.
 */
export type TwoStep = {
  gate: 'challenge' | 'setup' | null
  on: boolean
  required: boolean
  codesLeft: number
}

export const TWO_STEP_OFF: TwoStep = { gate: null, on: false, required: false, codesLeft: 0 }

type StatusRow = { gate: TwoStep['gate']; on: boolean; required: boolean; codes_left: number }

const deviceKey = (userId: string) => `ontrack.two-step-device.${userId}`

function readDeviceToken(userId: string) {
  try {
    return localStorage.getItem(deviceKey(userId))
  } catch {
    return null
  }
}

export function saveDeviceToken(userId: string, token: string | null) {
  try {
    if (token) localStorage.setItem(deviceKey(userId), token)
    else localStorage.removeItem(deviceKey(userId))
  } catch {
    // Private windows: they are simply asked for a code next time.
  }
}

async function fetchStatus(): Promise<TwoStep> {
  const { data, error } = await supabase!.rpc('two_step_status')
  if (error) throw error
  const row = data as StatusRow
  return { gate: row.gate, on: row.on, required: row.required, codesLeft: row.codes_left }
}

/** The status, after spending this phone's remembered token if a code is owed. */
export async function readTwoStep(userId: string): Promise<TwoStep> {
  const status = await fetchStatus()
  if (status.gate !== 'challenge') return status
  const token = readDeviceToken(userId)
  if (!token) return status
  const { data, error } = await supabase!.rpc('use_remembered_device', { p_token: token })
  if (error) throw error
  if (!data) {
    saveDeviceToken(userId, null)
    return status
  }
  return fetchStatus()
}
