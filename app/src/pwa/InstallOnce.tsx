import { useEffect, useState } from 'react'
import { InstallSheet } from '../components/InstallSheet'
import { useInstallPrompt } from './useInstallPrompt'

const ASKED = 'ontrack.install-asked'

function askedBefore() {
  try {
    return localStorage.getItem(ASKED) !== null
  } catch {
    return true
  }
}

function rememberAsked() {
  try {
    localStorage.setItem(ASKED, new Date().toISOString())
  } catch {
    // A browser that won't store it may ask again; that's all.
  }
}

/**
 * The install sheet once on this phone, the first time a signed-in screen opens and the
 * app can be installed (OT-72). After that, Profile has it. Chrome's offer can arrive a
 * moment after the screen, so this waits for it. A computer isn't asked.
 */
export function InstallOnce({ skip }: { skip: boolean }) {
  const { state, promptInstall } = useInstallPrompt()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (skip || open || (state !== 'available' && state !== 'ios-manual')) return
    if (!window.matchMedia?.('(pointer: coarse)').matches || askedBefore()) return
    rememberAsked()
    setOpen(true)
  }, [skip, state, open])

  return (
    <InstallSheet
      open={open}
      onOpenChange={setOpen}
      state={state}
      onInstall={() => {
        setOpen(false)
        void promptInstall()
      }}
    />
  )
}
