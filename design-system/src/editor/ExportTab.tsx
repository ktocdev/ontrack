import { useState } from 'react'
import { useToast } from '@app/components/Toast'
import {
  changedVars,
  editCount,
  emptyEdits,
  exportTokensCss,
  fontInstructions,
  overrideCss,
  normalizeEdits,
} from '../tokens/editor'
import type { Theme } from '../tokens/source'
import { useTokens } from '../tokens/store'
import { PanelButton, PanelSection } from './controls'

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportTab({ theme }: { theme: Theme }) {
  const { edits, replace, update } = useTokens()
  const toast = useToast()
  const [json, setJson] = useState('')
  const [error, setError] = useState<string | null>(null)
  const light = Object.keys(changedVars(edits, 'light')).length
  const dark = Object.keys(changedVars(edits, 'dark')).length
  const fonts = fontInstructions(edits)
  const total = editCount(edits)

  return (
    <>
      <PanelSection title="What changed">
        <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-13">
          <dt className="text-ds-ink-soft">Light theme and shared</dt>
          <dd className="m-0 font-ds-mono text-ds-ink tabular-nums">{light}</dd>
          <dt className="text-ds-ink-soft">Dark theme</dt>
          <dd className="m-0 font-ds-mono text-ds-ink tabular-nums">{dark}</dd>
          <dt className="text-ds-ink-soft">Fonts</dt>
          <dd className="m-0 font-ds-mono text-ds-ink tabular-nums">{fonts.length}</dd>
        </dl>
        <p className="m-0 text-12 text-ds-muted">
          Edits are kept in this browser only, until you export them or reset.
        </p>
      </PanelSection>

      <PanelSection title="Take it to the app">
        <p className="m-0 text-13 leading-[1.5] text-ds-ink-soft">
          Download a <code className="font-ds-mono">tokens.css</code> with your values written in place, and replace{' '}
          <code className="font-ds-mono">app/src/styles/tokens.css</code> with it. Comments and order stay as they are.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <PanelButton primary onClick={() => download('tokens.css', exportTokensCss(edits), 'text/css')}>
            Download tokens.css
          </PanelButton>
          <PanelButton
            onClick={async () => {
              const css = overrideCss(edits)
              toast.show(
                css ? ((await copy(css)) ? 'Changed values copied.' : "Couldn't copy.") : 'Nothing changed yet.',
              )
            }}
          >
            Copy changes only
          </PanelButton>
        </div>
        {fonts.length > 0 && (
          <div className="rounded-[10px] bg-ds-sunken p-3 text-12 leading-[1.5] text-ds-ink-soft">
            <p className="m-0 mb-1 font-semibold text-ds-ink">The new fonts also need:</p>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-4 font-ds-mono text-11">
              {fonts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </PanelSection>

      <PanelSection title="Share a draft">
        <p className="m-0 text-13 text-ds-ink-soft">Copy the edits as JSON, or paste some to load them here.</p>
        <PanelButton
          onClick={async () =>
            toast.show((await copy(JSON.stringify(edits, null, 2))) ? 'Edits copied as JSON.' : "Couldn't copy.")
          }
        >
          Copy edits as JSON
        </PanelButton>
        <label className="flex flex-col gap-1.5 text-13 font-semibold text-ds-ink-soft">
          Paste edits
          <textarea
            value={json}
            onChange={(e) => {
              setJson(e.target.value)
              setError(null)
            }}
            rows={4}
            spellCheck={false}
            className="rounded-[10px] border border-ds-line-strong bg-ds-panel p-2 font-ds-mono text-[16px] text-ds-ink sm:text-12"
          />
        </label>
        {error && <p className="m-0 text-12 text-ds-warn">{error}</p>}
        <PanelButton
          onClick={() => {
            try {
              replace(normalizeEdits(JSON.parse(json)))
              setJson('')
              toast.show('Edits loaded.')
            } catch {
              setError("That isn't JSON from Copy edits.")
            }
          }}
        >
          Load pasted edits
        </PanelButton>
      </PanelSection>

      <PanelSection title="Start over">
        <div className="grid grid-cols-2 gap-2">
          <PanelButton
            onClick={() =>
              update((d) => {
                d[theme] = emptyEdits()[theme]
              })
            }
          >
            Reset {theme} colors
          </PanelButton>
          <PanelButton
            onClick={() => {
              if (total === 0 || window.confirm(`Reset all ${total} edits? This can't be undone.`))
                replace(emptyEdits())
            }}
          >
            Reset everything
          </PanelButton>
        </div>
      </PanelSection>
    </>
  )
}
