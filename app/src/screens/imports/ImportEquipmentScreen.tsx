import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { AREA_SHORT } from '../../app/areas'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Select } from '../../components/Field'
import { guessColumns, readByColumns, sampleOf, unusedColumns } from '../../lib/import/columns'
import { useAllCategories } from '../mycategories/useMyCategories'
import {
  areaOf,
  EQUIPMENT_FIELDS,
  EQUIPMENT_LATER,
  EQUIPMENT_TEMPLATE,
  equipmentPayload,
  equipmentReviewFirst,
  equipmentReviewSecond,
  restaurantOf,
  type Category,
  type EquipmentField,
} from './equipmentImport'
import { MapField, NotImported, ReadyList, ReviewCounts } from './ImportParts'
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
import { type ImportResult } from './useImportContractors'
import { useImportEquipment, useUnitsForImport } from './useImportEquipment'
import { useSheetPick } from './useSheetPick'

type Chosen = Record<EquipmentField, number | null>

const HOME = '/ops/equipment'
const NO_CATEGORIES: Category[] = []

/**
 * Ops · Import equipment (design/screens/Import-Equipment-Start, -Map, -Review, -Done;
 * OT-152), on Import contractors' pieces. One restaurant (picked on Match columns when the
 * sheet has no Restaurant column, or from the equipment list's picker), or all of them
 * from a Restaurant column. Review asks about restaurants, areas and categories the lists
 * don't have, with suggestions ("Federales LS"), what a unit is missing, and units already
 * at that restaurant (same name, or same serial), to skip or update. Categories are added on
 * Categories, never here. The boards' QR labels wait for OT-74. For Ops with Add / edit
 * equipment (the database asks at each row's restaurant); never under View as.
 */
export function ImportEquipmentScreen() {
  const { user, viewingAs } = useUser()
  const right = useRight('edit_equipment')
  // Wait for the right to load; send away only a real no, so a fresh load doesn't bounce.
  if (right === undefined && !viewingAs) return null
  if (!right || viewingAs || !(user.role === 'ops' || user.is_admin)) return <Navigate to={HOME} replace />
  return <ImportEquipment />
}

function ImportEquipment() {
  const { restaurants } = useUser()
  const [params] = useSearchParams()
  const categories = (useAllCategories().data as Category[] | undefined) ?? NO_CATEGORIES
  const ids = useMemo(() => restaurants.map((r) => r.id), [restaurants])
  const units = useUnitsForImport(ids).data
  const run = useImportEquipment()
  const [step, setStep] = useState<ImportStep>('start')
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [one, setOne] = useState<string | null>(() => {
    const asked = params.get('restaurant')
    return restaurants.length === 1 ? restaurants[0]!.id : (restaurants.find((r) => r.id === asked)?.id ?? null)
  })
  const [resolutions, setResolutions] = useState<Resolutions>({})
  const [updates, setUpdates] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<(ImportResult & { skippedHere: number }) | null>(null)
  const sheet = useSheetPick((read) => {
    const g = guessColumns(read, EQUIPMENT_FIELDS)
    setChosen(Object.fromEntries(g.map((x) => [x.key, x.column])) as Chosen)
    setResolutions({})
    setUpdates(new Set())
  })
  const file = sheet.file

  // A Restaurant column wins over one picked for every row.
  const oneRestaurant = chosen?.restaurant != null ? null : one
  const guesses = useMemo(() => (file ? guessColumns(file.sheet, EQUIPMENT_FIELDS) : []), [file])
  const records = useMemo(() => (file && chosen ? readByColumns(file.sheet, chosen) : []), [file, chosen])
  const mapped = new Set(EQUIPMENT_FIELDS.filter((f) => chosen?.[f.key] != null).map((f) => f.key))

  const rows = records.map((r) => r.row)
  const first = useMemo(
    () => equipmentReviewFirst(records, restaurants, !!oneRestaurant),
    [records, restaurants, oneRestaurant],
  )
  const settledRecords = applyFixes(records, first, resolutions)
  const firstStates = rowStates(rows, first, resolutions, new Set())
  const settled = new Set(rows.filter((n) => firstStates.get(n) === 'ready'))
  const second = equipmentReviewSecond(settledRecords, settled, restaurants, oneRestaurant, categories, units ?? [])
  const issues = [...first, ...second.issues]
  const fixed = applyFixes(records, issues, resolutions)
  const states = rowStates(rows, issues, resolutions, new Set(second.duplicates.keys()))
  const n = counts(states)
  const importing = n.ready + [...updates].filter((r) => states.get(r) === 'duplicate').length
  const reqMissing = EQUIPMENT_FIELDS.some(
    (f) => f.required && chosen?.[f.key] == null && !(f.key === 'restaurant' && one),
  )

  const go = (s: ImportStep) => {
    run.reset()
    setStep(s)
  }
  const submit = () => {
    const payload = equipmentPayload(fixed, states, updates, mapped, restaurants, oneRestaurant, categories)
    run.mutate(
      { restaurantId: oneRestaurant, rows: payload.rows, columns: payload.columns, fileName: file!.name },
      {
        onSuccess: (r) => {
          setResult({ ...r, skippedHere: records.length - payload.rows.length })
          setStep('done')
        },
      },
    )
  }

  const name = (id: string | undefined) => restaurants.find((r) => r.id === id)?.name
  const readyRows = fixed.filter((r) => states.get(r.row) === 'ready')

  return (
    <ImportSteps
      kind="equipment"
      step={step}
      onGo={go}
      home={HOME}
      rows={records.length}
      hasFile={!!file}
      reqMissing={reqMissing}
      fix={n.fix}
      importing={importing}
      waiting={!units}
      pending={run.isPending}
      onSubmit={submit}
    >
      {step === 'start' && (
        <StartStep
          intro="Import one restaurant or all of them from the same sheet. You’ll match its columns to OnTrack next."
          sheet={sheet}
          templateName="equipment-template.csv"
          template={EQUIPMENT_TEMPLATE}
        />
      )}

      {step === 'map' && file && chosen && (
        <>
          <MapIntro mapped={mapped.size} total={EQUIPMENT_FIELDS.length} />
          {EQUIPMENT_FIELDS.map((f) => {
            const column = chosen[f.key]
            const used = new Set(Object.values(chosen).filter((c): c is number => c !== null))
            const s = guesses.find((g) => g.key === f.key)?.suggestion ?? null
            const isRestaurant = f.key === 'restaurant'
            return (
              <MapField
                key={f.key}
                title={f.title}
                required={f.required}
                column={column}
                columns={sheet.columns}
                sample={sampleOf(file.sheet, column)}
                suggestion={s !== null && !used.has(s) ? { title: file.sheet.header[s]!, i: s } : null}
                note={column === null && !f.required ? EQUIPMENT_LATER[f.key] : undefined}
                satisfied={isRestaurant && column === null && !!one}
                onPick={(c) => setChosen({ ...chosen, [f.key]: c })}
              >
                {isRestaurant && column === null && (
                  <Select label="Or every row is at" value={one ?? ''} onChange={(e) => setOne(e.target.value || null)}>
                    <option value="">Choose a restaurant</option>
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                )}
              </MapField>
            )
          })}
          <NotImported titles={unusedColumns(file.sheet, Object.values(chosen)).map((c) => c.title)} />
        </>
      )}

      {step === 'review' && (
        <>
          <ReviewCounts ready={n.ready} fix={n.fix} duplicate={n.duplicate} />
          <IssueList issues={issues} resolutions={resolutions} onChange={setResolutions} />
          <DuplicateList
            rows={fixed
              .filter((r) => states.get(r.row) === 'duplicate')
              .map((r) => ({ row: r.row, ...second.duplicates.get(r.row)! }))}
            updates={updates}
            onChange={setUpdates}
          />
          {n.ready > 0 && <span className="eyebrow pt-1.5">Ready · {n.ready}</span>}
          <ReadyList
            total={n.ready}
            rows={readyRows.slice(0, 3).map((r) => {
              const area = areaOf(r.values.area)
              return {
                title: r.values.name,
                sub: [
                  name(restaurantOf(r.values.restaurant, restaurants, oneRestaurant)),
                  area && AREA_SHORT[area],
                  r.values.category,
                  r.values.brand,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }
            })}
          />
          {run.isError && <ImportFailed error={run.error} />}
        </>
      )}

      {step === 'done' && result && file && (
        <ImportDoneStep
          kind="equipment"
          file={file.name}
          result={{ ...result, skipped: result.skipped + result.skippedHere }}
        />
      )}
    </ImportSteps>
  )
}
