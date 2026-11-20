import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button, ButtonLink } from '../../components/Button'
import { ErrorBanner } from '../../components/Notice'
import { Screen } from '../../components/Screen'
import { guessColumns, readByColumns, sampleOf, unusedColumns } from '../../lib/import/columns'
import { toCsv } from '../../lib/import/csv'
import { downloadText } from '../../lib/import/sheet'
import { splitList } from '../../lib/import/values'
import { useCanEditTrades, useTrades } from '../trades/useTrades'
import {
  CONTRACTOR_FIELDS,
  CONTRACTOR_LATER,
  CONTRACTOR_TEMPLATE,
  contractorPayload,
  contractorReview,
  pickedTrade,
  type ContractorField,
  type Trade,
} from './contractorImport'
import {
  DuplicateCard,
  FileChoice,
  FooterHint,
  ImportDone,
  ImportFrame,
  MapField,
  NotImported,
  ReadyList,
  ReviewCounts,
  TemplateCard,
} from './ImportParts'
import { importMessage, IssueList, useSheetPick } from './importFlow'
import { applyFixes, counts, rowStates, type Resolutions } from './review'
import { useContractorNames, useImportContractors, type ImportResult } from './useImportContractors'

type Step = 'start' | 'map' | 'review' | 'done'
type Chosen = Record<ContractorField, number | null>

const HOME = '/ops/contractors'
const NO_TRADES: Trade[] = []
const NO_NAMES: { id: string; name: string }[] = []

/**
 * Ops · Import contractors (design/screens/Import-Contractors-Start, -Map, -Review, -Done;
 * OT-151). Choose a spreadsheet (read on the phone, never uploaded), match its columns to
 * the fields with guesses and one-tap suggestions, review: fix or skip what each problem
 * covers, skip or update each contractor already in OnTrack, then import in one logged step
 * (import_contractors). Rows still needing a fix are skipped. Done counts what was added,
 * updated and skipped, and says the import can be undone for 24 hours. For Ops with Log
 * cost and admins, as Add contractor; never under View as.
 */
export function ImportContractorsScreen() {
  const { user } = useUser()
  const logsCost = useRight('log_cost')
  const canEdit = useCanEditTrades()
  // Wait for the right to load; send away only a real no, so a fresh load doesn't bounce.
  if (!user.is_admin && user.role === 'ops' && logsCost === undefined) return null
  if (!canEdit) return <Navigate to={HOME} replace />
  return <ImportContractors />
}

function ImportContractors() {
  const trades = useTrades().data ?? NO_TRADES
  const names = useContractorNames().data ?? NO_NAMES
  const run = useImportContractors()
  const [step, setStep] = useState<Step>('start')
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [resolutions, setResolutions] = useState<Resolutions>({})
  const [updates, setUpdates] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<(ImportResult & { skippedHere: number }) | null>(null)
  const sheet = useSheetPick((read) => {
    const g = guessColumns(read, CONTRACTOR_FIELDS)
    setChosen(Object.fromEntries(g.map((x) => [x.key, x.column])) as Chosen)
    setResolutions({})
    setUpdates(new Set())
  })
  const file = sheet.file

  const guesses = useMemo(() => (file ? guessColumns(file.sheet, CONTRACTOR_FIELDS) : []), [file])
  const records = useMemo(() => (file && chosen ? readByColumns(file.sheet, chosen) : []), [file, chosen])
  const mapped = useMemo(
    () => new Set(CONTRACTOR_FIELDS.filter((f) => chosen?.[f.key] != null).map((f) => f.key)),
    [chosen],
  )
  const review = useMemo(() => contractorReview(records, mapped, trades, names), [records, mapped, trades, names])
  const fixed = applyFixes(records, review.issues, resolutions, pickedTrade)
  const states = rowStates(
    records.map((r) => r.row),
    review.issues,
    resolutions,
    new Set(review.duplicates.keys()),
  )
  const n = counts(states)
  const importing = n.ready + [...updates].filter((r) => states.get(r) === 'duplicate').length
  const reqMissing = CONTRACTOR_FIELDS.some((f) => f.required && chosen?.[f.key] == null)

  const go = (s: Step) => {
    run.reset()
    setStep(s)
  }
  const submit = () => {
    const { columns, rows, newTrades } = contractorPayload(fixed, states, updates, mapped, resolutions)
    run.mutate(
      { rows, columns, newTrades, fileName: file!.name },
      {
        onSuccess: (r) => {
          setResult({ ...r, skippedHere: records.length - rows.length })
          setStep('done')
        },
      },
    )
  }

  const back = step === 'map' ? () => go('start') : step === 'review' ? () => go('map') : undefined
  const title =
    step === 'start'
      ? 'Import contractors'
      : step === 'map'
        ? 'Match columns'
        : step === 'review'
          ? `Review ${records.length} ${records.length === 1 ? 'row' : 'rows'}`
          : 'Import complete'

  const footer =
    step === 'start' ? (
      <Button disabled={!file} onClick={() => go('map')}>
        Next: match columns
      </Button>
    ) : step === 'map' ? (
      <>
        {reqMissing && <FooterHint>Match every required field to continue.</FooterHint>}
        <Button disabled={reqMissing} onClick={() => go('review')}>
          Next: review rows
        </Button>
      </>
    ) : step === 'review' ? (
      <>
        {n.fix > 0 && (
          <FooterHint>
            {n.fix} {n.fix === 1 ? 'row that still needs a fix' : 'rows that still need a fix'} will be skipped.
          </FooterHint>
        )}
        <Button disabled={importing === 0} loading={run.isPending} onClick={submit}>
          Import {importing} {importing === 1 ? 'contractor' : 'contractors'}
        </Button>
      </>
    ) : (
      <ButtonLink to={HOME}>View contractors</ButtonLink>
    )

  const columns = sheet.columns
  const readyRows = fixed.filter((r) => states.get(r.row) === 'ready')

  return (
    <Screen>
      <ImportFrame
        step={step === 'start' ? 1 : step === 'map' ? 2 : step === 'review' ? 3 : 4}
        label="Contractors"
        title={title}
        onBack={back}
        closeTo={HOME}
        footer={footer}
      >
        {step === 'start' && (
          <>
            <p className="flex-none text-14 leading-normal text-text-body">
              Use the contractor list you already keep. Any layout works. You’ll match its columns to OnTrack next.
            </p>
            {sheet.fileInput}
            <FileChoice reading={sheet.reading} file={sheet.summary} onChoose={sheet.choose} onChange={sheet.choose} />
            {sheet.error && <ErrorBanner title="Couldn't read that file.">{sheet.error}</ErrorBanner>}
            <TemplateCard onDownload={() => downloadText('contractors-template.csv', toCsv(CONTRACTOR_TEMPLATE))} />
          </>
        )}

        {step === 'map' && file && chosen && (
          <>
            <p className="flex-none text-14 leading-normal text-text-body">
              We matched{' '}
              <b>
                {mapped.size} of {CONTRACTOR_FIELDS.length}
              </b>{' '}
              fields to your columns. Check anything marked, then continue.
            </p>
            {CONTRACTOR_FIELDS.map((f) => {
              const column = chosen[f.key]
              const used = new Set(Object.values(chosen).filter((c): c is number => c !== null))
              const s = guesses.find((g) => g.key === f.key)?.suggestion ?? null
              return (
                <MapField
                  key={f.key}
                  title={f.title}
                  required={f.required}
                  column={column}
                  columns={columns}
                  sample={sampleOf(file.sheet, column)}
                  suggestion={s !== null && !used.has(s) ? { title: file.sheet.header[s]!, i: s } : null}
                  note={column === null && !f.required ? CONTRACTOR_LATER[f.key] : undefined}
                  onPick={(c) => setChosen({ ...chosen, [f.key]: c })}
                />
              )
            })}
            <NotImported titles={unusedColumns(file.sheet, Object.values(chosen)).map((c) => c.title)} />
          </>
        )}

        {step === 'review' && (
          <>
            <ReviewCounts ready={n.ready} fix={n.fix} duplicate={n.duplicate} />
            <IssueList issues={review.issues} resolutions={resolutions} onChange={setResolutions} />
            {review.duplicates.size > 0 && <span className="eyebrow pt-1.5">Already in OnTrack</span>}
            {fixed
              .filter((r) => states.get(r.row) === 'duplicate')
              .map((r) => (
                <DuplicateCard
                  key={r.row}
                  title={review.duplicates.get(r.row) ?? r.values.name}
                  sub={`Row ${r.row} · same name as a contractor already in OnTrack`}
                  update={updates.has(r.row)}
                  onChange={(u) => {
                    const next = new Set(updates)
                    if (u) next.add(r.row)
                    else next.delete(r.row)
                    setUpdates(next)
                  }}
                />
              ))}
            {n.ready > 0 && <span className="eyebrow pt-1.5">Ready · {n.ready}</span>}
            <ReadyList
              total={n.ready}
              rows={readyRows.slice(0, 3).map((r) => ({
                title: r.values.name,
                sub: [splitList(r.values.trades).join(', '), r.values.contact, r.values.phone]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />
            {run.isError && (
              <ErrorBanner title="Nothing was imported.">
                {importMessage(run.error)} Fix it in the sheet and choose it again, or skip that row.
              </ErrorBanner>
            )}
          </>
        )}

        {step === 'done' && result && file && (
          <ImportDone
            title={`${result.added + result.updated} ${result.added + result.updated === 1 ? 'contractor' : 'contractors'} imported`}
            file={file.name}
            added={result.added}
            updated={result.updated}
            skipped={result.skipped + result.skippedHere}
            note="Imported by mistake? You can undo this import for 24 hours from Contractors."
          />
        )}
      </ImportFrame>
    </Screen>
  )
}
