// @card ThreadMessage Thread 500
import React, { useState } from 'react'
import { AddPhotoButton, Avatar, Composer, ThreadEvent, ThreadMessage, VisibilityToggle } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [draft, setDraft] = useState('')
  const [internal, setInternal] = useState(false)
  return (
    <>
      <div className="flex flex-col rounded-card border border-border bg-surface px-3 py-1">
        <ThreadEvent text="Bert Velilla took this · status In progress" when="9:40 AM" />
        <ThreadMessage
          who="Bert Velilla, Ops"
          when="1h ago"
          avatar={<Avatar name="Bert Velilla" role="ops" size={30} />}
        >
          Refrigeration tech booked for today 2–4 PM.
        </ThreadMessage>
        <ThreadMessage who="You" when="45m ago" mine avatar={<Avatar name="Maya Reyes" size={30} />}>
          Thanks. Lunch rush ends at 2, so that window works.
        </ThreadMessage>
        <ThreadMessage
          internal
          mine
          who="You"
          when="50m ago"
          avatar={<Avatar name="Bert Velilla" role="ops" size={30} />}
        >
          Coldline quoted $185 for the diagnostic.
        </ThreadMessage>
      </div>
      <VisibilityToggle internal={internal} onChange={setInternal} />
      <div className="overflow-hidden rounded-card border border-border">
        <Composer
          leading={<AddPhotoButton variant="icon" onFiles={() => undefined} />}
          label="Write an update"
          placeholder="Write an update…"
          value={draft}
          onChange={setDraft}
          onSend={() => setDraft('')}
        />
      </div>
    </>
  )
}
mount(<Demo />)
