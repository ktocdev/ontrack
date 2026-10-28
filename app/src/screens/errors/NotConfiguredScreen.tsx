import { IconServer } from '../../components/icons'
import { Screen } from '../../components/Screen'
import { ErrorBlock } from './ErrorBlock'

/** Shown by a build with no Supabase URL and anon key. Developers only. */
export function NotConfiguredScreen() {
  return (
    <Screen>
      <ErrorBlock
        code="Not configured"
        icon={<IconServer />}
        title="This build has no backend"
        body={
          <>
            Set <code className="font-mono text-13">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono text-13">VITE_SUPABASE_ANON_KEY</code> (see{' '}
            <code className="font-mono text-13">.env.example</code>) and rebuild. The component kit at{' '}
            <code className="font-mono text-13">/kit</code> works without them.
          </>
        }
      />
    </Screen>
  )
}
