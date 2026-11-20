import { useState } from 'react'
import { Button } from '../../components/Button'
import { ErrorBanner } from '../../components/Notice'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { ago } from '../tickets/tickets'
import { importCount, namesLine } from './review'
import { UndoImportLine, UndoPreviewList } from './UndoImportParts'
import { useUndoableImport, useUndoImport, useUndoPreview, type ImportKind } from './useUndoImport'

/**
 * Undo an import for 24 hours (OT-153; no board draws it): on Contractors and on Equipment,
 * a line about the person's latest import still in its 24 hours, with Undo. The confirm step
 * says what undo takes back (what the import added that nothing points to yet, and what it
 * changed that nobody has changed since, put back) and what it keeps (what has gained
 * history since, by name), and until when. Undo is one logged step, by the archive and
 * delete rule (undo_import, OT-149). The pieces are in UndoImportParts, on /kit.
 */
export function UndoImportBanner({ kind }: { kind: ImportKind }) {
  const { data } = useUndoableImport(kind)
  const [open, setOpen] = useState(false)
  const [now] = useState(() => new Date())
  if (!data) return null
  return (
    <>
      <UndoImportLine
        kind={kind}
        rows={data.added.length + (Array.isArray(data.updated) ? data.updated.length : 0)}
        fileName={data.file_name}
        when={ago(new Date(data.created_at), now)}
        onUndo={() => setOpen(true)}
      />
      {open && <UndoSheet id={data.id} kind={kind} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Undone already, past its 24 hours, or no longer there (P0002 since OT-154). */
const goneMessage = (error: unknown) =>
  ['55000', 'P0002'].includes((error as { code?: string } | null)?.code ?? '')
    ? 'It was undone already, or its 24 hours are up.'
    : 'Check your connection and try again.'

function UndoSheet({ id, kind, onClose }: { id: string; kind: ImportKind; onClose: () => void }) {
  const preview = useUndoPreview(id)
  const undo = useUndoImport(kind)
  const toast = useToast()
  const p = preview.data
  const run = () =>
    undo.mutate(id, {
      onSuccess: (r) => {
        toast.show(
          `Import undone. ${r.removed > 0 ? `Removed ${importCount(r.removed, kind)}.` : ''}${
            r.kept.length > 0 ? ` Kept ${namesLine(r.kept)}.` : ''
          }`.trim(),
        )
        onClose()
      },
    })
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Undo this import?">
      {preview.isPending ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : preview.isError ? (
        <ErrorBanner title="This import can’t be undone now.">{goneMessage(preview.error)}</ErrorBanner>
      ) : (
        p && <UndoPreviewList kind={kind} preview={p} />
      )}
      {undo.isError && <ErrorBanner title="Couldn't undo this.">{goneMessage(undo.error)}</ErrorBanner>}
      <Button variant="danger" disabled={!p} loading={undo.isPending} onClick={run}>
        Undo import
      </Button>
      <Button variant="secondary" onClick={onClose}>
        Keep it
      </Button>
    </Sheet>
  )
}
