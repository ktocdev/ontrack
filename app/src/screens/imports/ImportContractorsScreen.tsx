import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useLaptop } from '../../lib/useWide'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { guessColumns, readByColumns, sampleOf, unusedColumns } from '../../lib/import/columns'
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
import { MapField, NotImported, ReadyList, ReviewCounts, ReviewTable } from './ImportParts'
import {
  DuplicateList,
  ImportDoneStep,
  ImportFailed,
  ImportSteps,
  IssueList,
  MapIntro,
  StartStep,
  type ImportStep,
} from './ImportSteps'
import { applyFixes, counts, rowStates, type Resolutions } from './review'
import { useContractorNames, useImportContractors, type ImportResult } from './useImportContractors'
import { useSheetPick } from './useSheetPick'

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
  const [step, setStep] = useState<ImportStep>('start')
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

  const go = (s: ImportStep) => {
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

  const readyRows = fixed.filter((r) => states.get(r.row) === 'ready')
  // On a laptop every row shows in a table beside the fixes (OT-161).
  const laptop = useLaptop()
  const table =
    step === 'review' && laptop ? (
      <ReviewTable
        columns={CONTRACTOR_FIELDS.filter((f) => mapped.has(f.key)).map((f) => ({ key: f.key, title: f.title }))}
        rows={fixed.map((r) => ({
          row: r.row,
          values: r.values,
          state: states.get(r.row)!,
          update: updates.has(r.row),
        }))}
        problems={
          new Set(review.issues.filter((x) => !resolutions[x.id]).flatMap((x) => x.rows.map((n) => `${n}:${x.field}`)))
        }
      />
    ) : undefined

  return (
    <ImportSteps
      kind="contractors"
      step={step}
      onGo={go}
      home={HOME}
      rows={records.length}
      hasFile={!!file}
      reqMissing={reqMissing}
      fix={n.fix}
      importing={importing}
      pending={run.isPending}
      onSubmit={submit}
      table={table}
    >
      {step === 'start' && (
        <StartStep
          intro="Use the contractor list you already keep. Any layout works. You’ll match its columns to OnTrack next."
          sheet={sheet}
          templateName="contractors-template.csv"
          template={CONTRACTOR_TEMPLATE}
        />
      )}

      {step === 'map' && file && chosen && (
        <>
          <MapIntro mapped={mapped.size} total={CONTRACTOR_FIELDS.length} />
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
                columns={sheet.columns}
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
          <DuplicateList
            rows={fixed
              .filter((r) => states.get(r.row) === 'duplicate')
              .map((r) => ({
                row: r.row,
                title: review.duplicates.get(r.row) ?? r.values.name,
                sub: `Row ${r.row} · same name as a contractor already in OnTrack`,
              }))}
            updates={updates}
            onChange={setUpdates}
          />
          {!table && n.ready > 0 && <span className="eyebrow pt-1.5">Ready · {n.ready}</span>}
          {!table && (
            <ReadyList
              total={n.ready}
              rows={readyRows.slice(0, 3).map((r) => ({
                title: r.values.name,
                sub: [splitList(r.values.trades).join(', '), r.values.contact, r.values.phone]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />
          )}
          {run.isError && <ImportFailed error={run.error} />}
        </>
      )}

      {step === 'done' && result && file && (
        <ImportDoneStep
          kind="contractors"
          file={file.name}
          result={{ ...result, skipped: result.skipped + result.skippedHere }}
        />
      )}
    </ImportSteps>
  )
}
