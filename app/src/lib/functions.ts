import { FunctionsHttpError } from '@supabase/supabase-js'
import { requireSupabase } from './supabase'

/** A function's refusal: `code` is its stable error code, or 'network' if it never answered. */
export class FunctionError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

/** Call an Edge Function; the signed-in person's token goes with it. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const answer = (await error.context.json().catch(() => null)) as { error?: string } | null
      throw new FunctionError(answer?.error ?? 'server_error')
    }
    throw new FunctionError('network')
  }
  return data as T
}
