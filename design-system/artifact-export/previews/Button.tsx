// @card Button Actions 620
import React, { useState } from 'react'
import {
  Button,
  IconButton,
  OverflowMenu,
  IconChevronLeft,
  IconClose,
  IconQr,
  IconPlus,
  IconReopen,
  IconSignOut,
} from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [loading, setLoading] = useState(false)
  return (
    <>
      <Button>Create ticket</Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="danger">Delete restaurant</Button>
      <Button loading={loading} onClick={() => setLoading((v) => !v)}>
        {loading ? 'Saving…' : 'Tap to toggle loading'}
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="tall" icon={<IconReopen size={20} />}>
          Reopen ticket
        </Button>
        <Button variant="secondary-danger" icon={<IconSignOut />}>
          Sign out
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="compact" icon={<IconPlus size={18} />}>
          Invite
        </Button>
        <Button variant="medium">Ask admin for a new invite</Button>
        <Button variant="outline">Review &amp; submit</Button>
        <Button variant="done" disabled>
          Request sent
        </Button>
        <Button variant="small">Search equipment</Button>
        <Button variant="ghost">Report this problem</Button>
        <Button variant="ghost-danger">Remove</Button>
      </div>
      <div className="flex items-center gap-2">
        <IconButton label="Back">
          <IconChevronLeft />
        </IconButton>
        <IconButton label="Close">
          <IconClose />
        </IconButton>
        <IconButton label="Scan QR code" framed>
          <IconQr />
        </IconButton>
        <OverflowMenu
          label="More options"
          items={[
            { to: '#', label: 'View closed tickets' },
            { to: '#', label: 'Share link' },
          ]}
        />
      </div>
    </>
  )
}
mount(<Demo />)
