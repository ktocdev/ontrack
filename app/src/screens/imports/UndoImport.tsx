import { useState } from 'react'
import { Button } from '../../components/Button'
import { ErrorBanner } from '../../components/Notice'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconFileUpload } from '../../components/icons'
import { ago } from '../tickets/tickets'
import { namesLine } from './review'
import { useUndoableImport, useUndoImport, useUndoPreview, type ImportKind } from './useUndoImport'

/**
 * Undo an import for 24 hours (OT-153; no board draws it): on Contractors and on Equipment,
 * a line about the person's latest import still in its 24 hours, with Undo. The confirm step
 * says what undo takes back (what the import added that nothing points to yet, and what it
 * changed, put back) and what it keeps (what has gained history since, by name), and until
 * when. Undo is one logged step, by the archive and delete rule (undo_import, OT-149).
 */
const WORDS: Record<ImportKind, { one: string; many: string; history: string }> = {
  contractors: { one: 'contractor', many: 'contractors', history: 'visits on record' },
  equipment: { one: 'unit', many: 'units', history: 'tickets, service, tasks or files' },
}

const count = (n: number, kind: ImportKind) => `${n} ${n === 1 ? WORDS[kind].one : WORDS[kind].many}`

export function UndoImportBanner({ kind }: { kind: ImportKind }) {
  const { data } = useUndoableImport(kind)
  const [open, setOpen] = useState(false)
  const [now] = useState(() => new Date())
  if (!data) return null
  const n = data.added.length + (Array.isArray(data.updated) ? data.updated.length : 0)
  return (
    <>
      <div className="flex flex-none items-center gap-3 rounded-input border border-border bg-surface px-3.5 py-2.5">
        <IconFileUpload size={20} className="flex-none text-brand" />
        <span className="min-w-0 flex-1 text-13 leading-[1.4] text-text-body">
          You imported {count(n, kind)}
          {data.file_name ? (
            <>
              {' '}
              from <span className="[overflow-wrap:anywhere]">{data.file_name}</span>
            </>
          ) : null}{' '}
          · {ago(new Date(data.created_at), now)}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-10 flex-none px-1 text-14 font-semibold text-brand"
        >
          Undo
        </button>
      </div>
      {open && <UndoSheet id={data.id} kind={kind} onClose={() => setOpen(false)} />}
    </>
  )
}

function UndoSheet({ id, kind, onClose }: { id: string; kind: ImportKind; onClose: () => void }) {
  const preview = useUndoPreview(id)
  const undo = useUndoImport(kind)
  const toast = useToast()
  const p = preview.data
  const run = () =>
    undo.mutate(id, {
      onSuccess: (r) => {
        toast.show(
          `Import undone. ${r.removed > 0 ? `Removed ${count(r.removed, kind)}.` : ''}${
            r.kept.length > 0 ? ` Kept ${namesLine(r.kept)}.` : ''
          }`.trim(),
        )
        onClose()
      },
    })
  const until = p && new Date(p.until)
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Undo this import?">
      {preview.isPending ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : preview.isError ? (
        <ErrorBanner title="This import can’t be undone now.">
          {(preview.error as { code?: string }).code === '55000'
            ? 'It was undone already, or its 24 hours are up.'
            : 'Check your connection and try again.'}
        </ErrorBanner>
      ) : (
        p && (
          <ul className="flex flex-col gap-2 text-14 leading-[1.45] text-text-body">
            {p.remove > 0 && (
              <li>
                <b>Removes {count(p.remove, kind)}</b> it added.
              </li>
            )}
            {p.restore > 0 && (
              <li>
                <b>Puts back</b> what it changed on {count(p.restore, kind)}.
              </li>
            )}
            {p.keep.length > 0 && (
              <li>
                <b>Keeps {namesLine(p.keep)}</b>, which {p.keep.length === 1 ? 'has' : 'have'} {WORDS[kind].history}{' '}
                since.
              </li>
            )}
            {p.remove === 0 && p.restore === 0 && p.keep.length === 0 && (
              <li>Nothing it added is left to take back.</li>
            )}
            {until && (
              <li className="text-13 text-text-secondary">
                You can undo it until{' '}
                {until.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
              </li>
            )}
          </ul>
        )
      )}
      {undo.isError && (
        <ErrorBanner title="Couldn't undo this.">
          {(undo.error as { code?: string }).code === '55000'
            ? 'It was undone already, or its 24 hours are up.'
            : 'Check your connection and try again.'}
        </ErrorBanner>
      )}
      <Button variant="danger" disabled={!p} loading={undo.isPending} onClick={run}>
        Undo import
      </Button>
      <Button variant="secondary" onClick={onClose}>
        Keep it
      </Button>
    </Sheet>
  )
}
