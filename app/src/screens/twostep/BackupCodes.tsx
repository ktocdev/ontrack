import { useState } from 'react'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Skeleton'
import { IconCheck, IconCopy, IconDownload } from '../../components/icons'
import { useNewBackupCodes } from './useTwoStep'

const ACTION =
  'flex min-h-tap flex-1 items-center justify-center gap-1.5 rounded-control border border-border-strong bg-surface text-14 font-semibold text-text transition-colors hover:border-border-muted active:bg-surface-muted active:duration-0'

/**
 * 2-step setup · 4 Backup codes (design/screens/MFA-Backup), also what Profile's new
 * codes end on. The codes exist only here: the database keeps their hashes, so Done
 * stays off until the person says they have saved them.
 */
export function BackupCodes({ round, header, onDone }: { round: string; header: React.ReactNode; onDone: () => void }) {
  const codes = useNewBackupCodes(round)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const list = codes.data ?? []

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(list.join('\n'))
      setCopied(true)
    } catch {
      // No clipboard access: Download and writing them down still work.
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([`OnTrack backup codes\n\n${list.join('\n')}\n`], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'ontrack-backup-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {header}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-[22px]">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-26 font-bold tracking-[-0.02em]">Save your backup codes</h1>
          <p className="text-15 leading-normal text-text-secondary">
            If you lose your phone, each code gets you in once. Keep them somewhere safe, like a password manager.
          </p>
        </div>
        <div className="rounded-card border border-border bg-surface px-5 py-[18px]">
          {codes.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : codes.isError ? (
            <div className="flex flex-col gap-3">
              <span role="alert" className="text-13 font-semibold text-danger">
                Couldn&apos;t make your codes. Check your connection and try again.
              </span>
              <Button variant="secondary" onClick={() => void codes.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <ul aria-label="Backup codes" className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2.5 p-0">
              {list.map((code) => (
                <li key={code} className="font-mono text-15 font-medium tracking-[.04em]">
                  {code}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={ACTION}
            disabled={list.length === 0}
            onClick={() => void copy()}
            aria-live="polite"
          >
            {copied ? <IconCheck size={16} /> : <IconCopy />}
            {copied ? 'Copied' : 'Copy all'}
          </button>
          <button type="button" className={ACTION} disabled={list.length === 0} onClick={download}>
            <IconDownload />
            Download
          </button>
        </div>
        <label className="flex min-h-tap cursor-pointer items-start gap-2.5 text-14 leading-[1.4] text-text-body">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="m-0 h-5 w-5 flex-none accent-brand-fill"
          />
          I saved these codes somewhere I can find them
        </label>
      </div>
      <div className="flex-none px-6 pb-[max(28px,var(--safe-bottom))] pt-4">
        <Button disabled={!saved || list.length === 0} onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  )
}
