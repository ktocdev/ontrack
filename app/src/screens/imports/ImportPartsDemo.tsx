import { useState } from 'react'
import {
  DuplicateCard,
  FileChoice,
  ImportBanner,
  ImportDone,
  IssueCard,
  MapField,
  NotImported,
  ReadyList,
  ReviewCounts,
  TemplateCard,
} from './ImportParts'

/**
 * The import steps' pieces with the boards' sample values (Import-Contractors-*), for /kit
 * and the design-system docs. Nothing here imports anything.
 */
const COLUMNS = ['Vendor', 'Type', 'Contact', 'Cell', 'Email', 'Ins. exp', 'Notes', 'Acct #'].map((title, i) => ({
  title,
  i,
}))

export function ImportPartsDemo() {
  const [company, setCompany] = useState<number | null>(0)
  const [insurance, setInsurance] = useState<number | null>(null)
  const [fixed, setFixed] = useState<{ fixed: boolean; text: string } | null>(null)
  const [update, setUpdate] = useState(false)
  const [picked, setPicked] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <ImportBanner to="#" noun="contractors" />
      <FileChoice
        file={
          picked
            ? {
                name: 'Vendors 2026.xlsx',
                rows: 41,
                columns: 8,
                firstRows: [
                  'Coldline Refrigeration · Refrigeration · Rosa Alvarez',
                  'Northstar HVAC · HVAC · Kevin Brooks',
                ],
              }
            : null
        }
        onChoose={() => setPicked(true)}
        onChange={() => setPicked(false)}
      />
      <TemplateCard onDownload={() => undefined} />
      <MapField
        title="Company"
        required
        column={company}
        columns={COLUMNS}
        sample="Coldline Refrigeration"
        onPick={setCompany}
      />
      <MapField
        title="Insurance expires"
        column={insurance}
        columns={COLUMNS}
        sample="6/30/2027"
        suggestion={{ title: 'Ins. exp', i: 5 }}
        onPick={setInsurance}
      />
      <MapField
        title="Preferred"
        column={null}
        columns={COLUMNS}
        note="Not in your sheet. You can mark preferred contractors after importing."
        onPick={() => undefined}
      />
      <NotImported titles={['Acct #']} />
      <ReviewCounts ready={36} fix={4} duplicate={1} />
      <IssueCard
        title="“Refrig.” isn’t a trade"
        who="3 rows · Arctic Air, Polar Service, Kold Kings"
        rows={3}
        kind="pick"
        options={['Refrigeration', 'HVAC', 'Plumbing'].map((t) => ({ value: t, label: t }))}
        pickLabel="Choose a trade"
        initial="Refrigeration"
        done={fixed}
        onApply={(v) => setFixed({ fixed: true, text: `Set to ${v} · 3 rows ready` })}
        onSkip={() => setFixed({ fixed: false, text: 'Skipped 3 rows' })}
        onUndo={() => setFixed(null)}
      />
      <IssueCard
        title="Phone is missing"
        who="Brightway Glass · row 14"
        rows={1}
        kind="input"
        inputType="tel"
        placeholder="Phone number"
        onApply={() => undefined}
        onSkip={() => undefined}
        onUndo={() => undefined}
      />
      <DuplicateCard
        title="Coldline Refrigeration"
        sub="Row 3 · same name as a contractor already in OnTrack"
        update={update}
        onChange={setUpdate}
      />
      <ReadyList
        total={36}
        rows={[
          { title: 'Northstar HVAC', sub: 'HVAC · Kevin Brooks · (312) 555-0144' },
          { title: 'Pipeworks Plumbing', sub: 'Plumbing · Marco Ruiz · (773) 555-0121' },
        ]}
      />
      <ImportDone
        title="40 contractors imported"
        file="Vendors 2026.xlsx"
        added={40}
        updated={0}
        skipped={1}
        note="Imported by mistake? You can undo this import for 24 hours from Contractors."
      />
    </div>
  )
}
