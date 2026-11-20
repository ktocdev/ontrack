import { IconFileUpload } from '../../components/icons'
import { importCount, namesLine, UNDO_WORDS } from './review'
import type { ImportKind, UndoPreview } from './useUndoImport'

/**
 * Undo an import's pieces, drawn apart from their data so they show on /kit and in the
 * design-system docs (OT-154): the line on Contractors and Equipment, and what the confirm
 * step says undo takes back and keeps. UndoImport.tsx gives them the person's import.
 */

/** "You imported 40 contractors from Vendors 2026.xlsx · 2h ago", with Undo. */
export function UndoImportLine({
  kind,
  rows,
  fileName,
  when,
  onUndo,
}: {
  kind: ImportKind
  rows: number
  fileName: string | null
  when: string
  onUndo: () => void
}) {
  return (
    <div className="flex flex-none items-center gap-3 rounded-input border border-border bg-surface px-3.5 py-2.5">
      <IconFileUpload size={20} className="flex-none text-brand" />
      <span className="min-w-0 flex-1 text-13 leading-[1.4] text-text-body">
        You imported {importCount(rows, kind)}
        {fileName ? (
          <>
            {' '}
            from <span className="[overflow-wrap:anywhere]">{fileName}</span>
          </>
        ) : null}{' '}
        · {when}
      </span>
      <button type="button" onClick={onUndo} className="min-h-10 flex-none px-1 text-14 font-semibold text-brand">
        Undo
      </button>
    </div>
  )
}

/** What undo takes back and keeps, and until when, from undo_import_preview. */
export function UndoPreviewList({ kind, preview: p }: { kind: ImportKind; preview: UndoPreview }) {
  const until = new Date(p.until)
  return (
    <ul className="flex flex-col gap-2 text-14 leading-[1.45] text-text-body">
      {p.remove > 0 && (
        <li>
          <b>Removes {importCount(p.remove, kind)}</b> it added.
        </li>
      )}
      {p.restore > 0 && (
        <li>
          <b>Puts back</b> what it changed on {importCount(p.restore, kind)}.
        </li>
      )}
      {p.keep.length > 0 && (
        <li>
          <b>Keeps {namesLine(p.keep)}</b>, which {p.keep.length === 1 ? 'has' : 'have'} {UNDO_WORDS[kind].history}{' '}
          since.
        </li>
      )}
      {p.remove === 0 && p.restore === 0 && p.keep.length === 0 && <li>Nothing it added is left to take back.</li>}
      <li className="text-13 text-text-secondary">
        You can undo it until {until.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
      </li>
    </ul>
  )
}
