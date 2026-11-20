import type { ReactNode } from 'react'
import { Button, ButtonLink } from '../../components/Button'
import { ErrorBanner } from '../../components/Notice'
import { Screen } from '../../components/Screen'
import { toCsv } from '../../lib/import/csv'
import { downloadText } from '../../lib/import/sheet'
import { DuplicateCard, FileChoice, FooterHint, ImportDone, ImportFrame, IssueCard, TemplateCard } from './ImportParts'
import { importMessage } from './importMessage'
import { importCount, type Issue, type Resolutions } from './review'
import type { SheetPick } from './useSheetPick'

/**
 * What both imports' screens do the same way (OT-151, OT-152; shared in OT-154): the four
 * steps' frame, titles, Back and footer; the file step; the line over Match columns; the
 * problems to fix or skip; the rows already in OnTrack; the database's refusal; and the done
 * step. Each import keeps its own rules (fields, review, payload) and its own Match columns
 * and Ready rows.
 */

export type ImportStep = 'start' | 'map' | 'review' | 'done'
type Kind = 'contractors' | 'equipment'

const LABEL: Record<Kind, string> = { contractors: 'Contractors', equipment: 'Equipment' }
const NUMBER: Record<ImportStep, 1 | 2 | 3 | 4> = { start: 1, map: 2, review: 3, done: 4 }

/** The screen around the steps, with each step's title, Back and footer. */
export function ImportSteps({
  kind,
  step,
  onGo,
  home,
  rows,
  hasFile,
  reqMissing,
  fix,
  importing,
  waiting = false,
  pending,
  onSubmit,
  table,
  children,
}: {
  kind: Kind
  step: ImportStep
  onGo: (step: ImportStep) => void
  home: string
  /** The rows read from the file, for "Review 41 rows". */
  rows: number
  hasFile: boolean
  reqMissing: boolean
  /** Rows that still need a fix, which are skipped. */
  fix: number
  /** Rows the import sends: the ready ones and the duplicates to update. */
  importing: number
  /** What the review compares with hasn't loaded yet. */
  waiting?: boolean
  pending: boolean
  onSubmit: () => void
  /** The review table, on a laptop (OT-161). */
  table?: ReactNode
  children: ReactNode
}) {
  const title =
    step === 'start'
      ? `Import ${kind}`
      : step === 'map'
        ? 'Match columns'
        : step === 'review'
          ? `Review ${rows} ${rows === 1 ? 'row' : 'rows'}`
          : 'Import complete'
  const footer =
    step === 'start' ? (
      <Button disabled={!hasFile} onClick={() => onGo('map')}>
        Next: match columns
      </Button>
    ) : step === 'map' ? (
      <>
        {reqMissing && <FooterHint>Match every required field to continue.</FooterHint>}
        <Button disabled={reqMissing} onClick={() => onGo('review')}>
          Next: review rows
        </Button>
      </>
    ) : step === 'review' ? (
      <>
        {fix > 0 && (
          <FooterHint>
            {fix} {fix === 1 ? 'row that still needs a fix' : 'rows that still need a fix'} will be skipped.
          </FooterHint>
        )}
        <Button disabled={importing === 0 || waiting} loading={pending} onClick={onSubmit}>
          Import {importCount(importing, kind)}
        </Button>
      </>
    ) : (
      <ButtonLink to={home}>View {kind}</ButtonLink>
    )
  return (
    <Screen width={table ? 'full' : 'reading'}>
      <ImportFrame
        table={table}
        step={NUMBER[step]}
        label={LABEL[kind]}
        title={title}
        onBack={step === 'map' ? () => onGo('start') : step === 'review' ? () => onGo('map') : undefined}
        closeTo={home}
        footer={footer}
      >
        {children}
      </ImportFrame>
    </Screen>
  )
}

/** Step 1: what to choose, the file, why it couldn't be read, and the template. */
export function StartStep({
  intro,
  sheet,
  templateName,
  template,
}: {
  intro: string
  sheet: SheetPick
  templateName: string
  template: string[][]
}) {
  return (
    <>
      <p className="flex-none text-14 leading-normal text-text-body">{intro}</p>
      {sheet.fileInput}
      <FileChoice reading={sheet.reading} file={sheet.summary} onChoose={sheet.choose} onChange={sheet.choose} />
      {sheet.error && <ErrorBanner title="Couldn't read that file.">{sheet.error}</ErrorBanner>}
      <TemplateCard onDownload={() => downloadText(templateName, toCsv(template))} />
    </>
  )
}

/** "We matched 6 of 8 fields to your columns." */
export function MapIntro({ mapped, total }: { mapped: number; total: number }) {
  return (
    <p className="flex-none text-14 leading-normal text-text-body">
      We matched{' '}
      <b>
        {mapped} of {total}
      </b>{' '}
      fields to your columns. Check anything marked, then continue.
    </p>
  )
}

/** Each problem as a card: fix it for every row it covers, skip them, or undo either. */
export function IssueList<F extends string>({
  issues,
  resolutions,
  onChange,
}: {
  issues: Issue<F>[]
  resolutions: Resolutions
  onChange: (next: Resolutions) => void
}) {
  return (
    <>
      {issues.length > 0 && <span className="eyebrow pt-1.5">Needs a fix</span>}
      {issues.map((x) => {
        const res = resolutions[x.id]
        const rows = `${x.rows.length} ${x.rows.length > 1 ? 'rows' : 'row'}`
        return (
          <IssueCard
            key={x.id}
            title={x.title}
            who={x.who}
            rows={x.rows.length}
            kind={x.kind}
            options={x.options}
            pickLabel={x.pickLabel}
            initial={x.initial}
            inputType={x.inputType}
            placeholder={x.placeholder}
            done={
              res &&
              (res.status === 'fixed'
                ? { fixed: true, text: `${x.fixedText(res.value)} · ${rows} ready` }
                : { fixed: false, text: `Skipped ${rows}` })
            }
            onApply={(value) => onChange({ ...resolutions, [x.id]: { status: 'fixed', value } })}
            onSkip={() => onChange({ ...resolutions, [x.id]: { status: 'skipped' } })}
            onUndo={() => onChange({ ...resolutions, [x.id]: undefined })}
          />
        )
      })}
    </>
  )
}

/** Rows already in OnTrack, each skipped unless Update existing is picked. */
export function DuplicateList({
  rows,
  updates,
  onChange,
}: {
  rows: { row: number; title: string; sub: string }[]
  updates: Set<number>
  onChange: (next: Set<number>) => void
}) {
  if (rows.length === 0) return null
  return (
    <>
      <span className="eyebrow pt-1.5">Already in OnTrack</span>
      {rows.map((r) => (
        <DuplicateCard
          key={r.row}
          title={r.title}
          sub={r.sub}
          update={updates.has(r.row)}
          onChange={(u) => {
            const next = new Set(updates)
            if (u) next.add(r.row)
            else next.delete(r.row)
            onChange(next)
          }}
        />
      ))}
    </>
  )
}

/** The database refused a row, so nothing was imported. */
export function ImportFailed({ error }: { error: unknown }) {
  return (
    <ErrorBanner title="Nothing was imported.">
      {importMessage(error)} Fix it in the sheet and choose it again, or skip that row.
    </ErrorBanner>
  )
}

/** Step 4: the counts, and that the import can be undone for 24 hours. */
export function ImportDoneStep({
  kind,
  file,
  result,
}: {
  kind: Kind
  file: string
  result: { added: number; updated: number; skipped: number }
}) {
  return (
    <ImportDone
      title={`${importCount(result.added + result.updated, kind)} imported`}
      file={file}
      added={result.added}
      updated={result.updated}
      skipped={result.skipped}
      note={`Imported by mistake? You can undo this import for 24 hours from ${LABEL[kind]}.`}
    />
  )
}
