import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { ErrorBanner, Notice } from '../../components/Notice'
import { BackBar, Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconChevronDown, IconDownload, IconFile } from '../../components/icons'
import { toCsv } from '../../lib/import/csv'
import { downloadText, readSheetFile, SheetError } from '../../lib/import/sheet'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useAllCategories } from '../mycategories/useMyCategories'
import { itemKey, previewImport, readChecklist, templateRows, toImportJson, type ImportRow } from './importChecklist'
import { useChecklistChange, useChecklistEditor } from './useChecklistEditor'

const SHOWN = 12

/**
 * Ops · Import checklist (OT-137; no board draws it): download the template, which is the
 * checklist as it is now, change it in a spreadsheet, upload it (.xlsx or .csv), see what is
 * wrong row by row or what will change, and replace the checklist in one logged step. As
 * with every editor change, a checklist a walkthrough has had gets a new version, so every
 * walkthrough keeps its own. Needs set_walkthrough_schedule, and never under View as.
 */
export function ImportChecklistScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { viewingAs } = useUser()
  const canEdit = useRight('set_walkthrough_schedule') === true && !viewingAs
  const { data, isPending } = useChecklistEditor(id)
  const categories = useAllCategories().data ?? []
  const change = useChecklistChange()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [result, setResult] = useState<{ rows: ImportRow[]; problems: string[] } | null>(null)
  const back = `/ops/walkthroughs/checklists/${id}`

  if (isPending) {
    return (
      <Screen>
        <BackBar to={back} label="Back to the checklist" />
        <ScreenBody className="pt-2">
          <CardFeedSkeleton label="Loading the checklist" />
        </ScreenBody>
      </Screen>
    )
  }
  if (!data) return <NotFoundScreen />
  const { checklist, sections, items, used } = data

  const download = () =>
    downloadText(
      `${
        checklist.name
          .replace(/[^\w]+/g, '-')
          .replace(/^-|-$/g, '')
          .toLowerCase() || 'checklist'
      }.csv`,
      toCsv(templateRows(sections, items, categories)),
    )
  const pick = async (f: File | undefined) => {
    if (!f) return
    change.reset()
    setFile(f.name)
    setResult(null)
    setReadError(null)
    setReading(true)
    try {
      const sectionName = new Map(sections.map((s) => [s.id, s.name]))
      const has = new Map(
        items.map((i) => [itemKey(sectionName.get(i.section_id) ?? '', i.group_name, i.title), i.category_id]),
      )
      setResult(readChecklist(await readSheetFile(f), categories, has))
    } catch (e) {
      setReadError(e instanceof SheetError ? e.message : 'That file couldn’t be read. Try it as .xlsx or .csv.')
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }
  const ok = result && result.problems.length === 0 ? result.rows : null
  const preview = ok ? previewImport(sections, items, ok, used) : null
  const replace = () =>
    ok &&
    change.mutate(
      { fn: 'import_checklist', args: { p_template: checklist.id, p_rows: toImportJson(ok) } },
      {
        onSuccess: (newId) => {
          toast.show(
            newId && newId !== checklist.id
              ? 'Checklist imported as a new version. Walkthroughs that had the earlier one keep it.'
              : 'Checklist imported.',
          )
          navigate(`/ops/walkthroughs/checklists/${newId ?? checklist.id}`, { replace: true })
        },
      },
    )

  return (
    <Screen>
      <BackBar to={back} label="Back to the checklist" roomy>
        <span className="block truncate text-12 text-text-secondary">{checklist.name}</span>
        <h1 className="font-display text-20 font-bold text-text">Import from a spreadsheet</h1>
      </BackBar>
      <ScreenBody className="gap-3 pb-4 pt-2">
        {!canEdit ? (
          <p className="text-14 text-text-secondary">
            Importing a checklist needs the right to set the walkthrough schedule.
          </p>
        ) : (
          <>
            <Step n={1} title="Download the template">
              It has this checklist as it is now: one row per item, under Section, Group and Item, with directions, a
              how-to video link and a category if it has them. Change it in Excel, Numbers or Google Sheets.
              <Button variant="secondary" icon={<IconDownload size={18} />} className="mt-2.5" onClick={download}>
                Download template
              </Button>
            </Step>
            <Step n={2} title="Upload it">
              Save it as .xlsx or .csv. Nothing changes until you replace the checklist below.
              <input
                ref={input}
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                aria-label="Spreadsheet to import"
                onChange={(e) => void pick(e.target.files?.[0])}
              />
              <Button
                variant="secondary"
                icon={<IconFile size={18} />}
                className="mt-2.5"
                loading={reading}
                onClick={() => input.current?.click()}
              >
                {file ? 'Choose another file' : 'Choose file'}
              </Button>
              {file && !reading && <span className="mt-1.5 block truncate text-13 text-text-secondary">{file}</span>}
            </Step>

            {readError && <ErrorBanner title="Couldn't read that file.">{readError}</ErrorBanner>}
            {result && result.problems.length > 0 && (
              <ErrorBanner title={`This sheet needs ${result.problems.length === 1 ? 'a fix' : 'some fixes'}.`}>
                <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
                  {result.problems.slice(0, SHOWN).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {result.problems.length > SHOWN && <span>And {result.problems.length - SHOWN} more.</span>}
              </ErrorBanner>
            )}

            {preview && ok && (
              <>
                <span className="eyebrow pt-2">What will change</span>
                <ListCard className="flex-none">
                  <Count label="Added" items={preview.added.map((r) => `${r.section} › ${r.group} › ${r.title}`)} />
                  <Count
                    label="Changed"
                    items={preview.changed.map((c) => `${c.to.section} › ${c.to.group} › ${c.to.title}`)}
                  />
                  <Count label="As they were" count={preview.unchanged} />
                  <Count
                    label="Taken off"
                    items={preview.removed.map(
                      (i) =>
                        `${i.section} › ${i.group_name} › ${i.title}${i.kept ? ' (turned off, kept on the record)' : ''}`,
                    )}
                  />
                </ListCard>
                {(preview.newSections.length > 0 || preview.goneSections.length > 0) && (
                  <p className="text-13 leading-[1.45] text-text-secondary">
                    {preview.newSections.length > 0 && `New sections: ${preview.newSections.join(', ')}. `}
                    {preview.goneSections.length > 0 && `Taken off: ${preview.goneSections.join(', ')}.`}
                  </p>
                )}
                <Notice tone="info">
                  {used
                    ? 'Walkthroughs that have had this checklist keep it as it was. The import makes a new version for the next month.'
                    : 'No walkthrough has had this version yet, so the import replaces it.'}
                </Notice>
                {change.isError && (
                  <ErrorBanner title="Couldn't import this.">
                    {(change.error as { code?: string }).code === '40001'
                      ? 'Someone changed this checklist meanwhile. Go back to it and start again.'
                      : (change.error as { code?: string }).code === '23514'
                        ? 'A category in the sheet was turned off meanwhile. Choose the file again to see which.'
                        : 'Check your connection and try again.'}
                  </ErrorBanner>
                )}
              </>
            )}
          </>
        )}
      </ScreenBody>
      {canEdit && ok && (
        <ScreenFooter>
          <Button loading={change.isPending} onClick={replace}>
            Replace checklist with {ok.length} {ok.length === 1 ? 'item' : 'items'}
          </Button>
        </ScreenFooter>
      )}
    </Screen>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-none gap-3 rounded-card border border-border bg-surface px-3.5 py-3.5">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-tint font-display text-14 font-bold text-brand-strong"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col text-14 leading-[1.45] text-text-body">
        <h2 className="mb-0.5 text-15 font-semibold text-text">{title}</h2>
        {children}
      </div>
    </section>
  )
}

/** A line of the preview: how many, and the names under it when there are any. */
function Count({ label, items, count }: { label: string; items?: string[]; count?: number }) {
  const n = items ? items.length : (count ?? 0)
  const head = (
    <>
      <span className="flex-1 text-15 font-semibold">{label}</span>
      <span className="text-15 text-text-secondary">{n}</span>
    </>
  )
  if (!items || n === 0) {
    return (
      <div className="flex min-h-12 items-center gap-2 border-t border-surface-muted px-3.5 first:border-t-0">
        {head}
      </div>
    )
  }
  return (
    <details className="group border-t border-surface-muted first:border-t-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3.5 [&::-webkit-details-marker]:hidden">
        {head}
        <IconChevronDown size={16} className="text-text-secondary group-open:rotate-180" />
      </summary>
      <ul className="flex flex-col gap-1 px-3.5 pb-3 text-13 text-text-body">
        {items.slice(0, 50).map((t, i) => (
          <li key={i} className="[overflow-wrap:anywhere]">
            {t}
          </li>
        ))}
        {items.length > 50 && <li className="text-text-secondary">And {items.length - 50} more.</li>}
      </ul>
    </details>
  )
}
