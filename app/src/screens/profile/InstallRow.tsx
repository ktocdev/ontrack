import { useState } from 'react'
import { ListCard, ListRowButton, RowIcon } from '../../components/Card'
import { InstallSheet } from '../../components/InstallSheet'
import { SectionLabel } from '../../components/Screen'
import { IconChevronRight, IconDownload } from '../../components/icons'
import { useInstallPrompt } from '../../pwa/useInstallPrompt'

/**
 * Install the app, on Profile while this browser can install it and hasn't (OT-72). Gone
 * once it is installed, and where the browser can't install at all.
 */
export function InstallRow() {
  const { state, promptInstall } = useInstallPrompt()
  const [open, setOpen] = useState(false)
  if (state !== 'available' && state !== 'ios-manual') return null
  return (
    <>
      <SectionLabel className="-mb-0.5">This device</SectionLabel>
      <ListCard>
        <ListRowButton
          onClick={() => setOpen(true)}
          leading={
            <RowIcon>
              <IconDownload size={20} />
            </RowIcon>
          }
          title="Install the app"
          subtitle="Add OnTrack to your Home Screen"
          trailing={<IconChevronRight className="text-text-muted" />}
        />
      </ListCard>
      <InstallSheet
        open={open}
        onOpenChange={setOpen}
        state={state}
        onInstall={() => {
          setOpen(false)
          void promptInstall()
        }}
      />
    </>
  )
}
