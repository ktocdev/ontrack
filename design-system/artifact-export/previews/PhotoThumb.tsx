// @card PhotoThumb Thread 270
import React from 'react'
import { AddPhotoButton, PhotoThumb, PhotoTray } from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <div className="flex flex-wrap items-center gap-2">
      <PhotoThumb alt="A photo on a message" />
      <PhotoThumb alt="A photo on your own message" tinted />
      <PhotoThumb alt="A photo on the ticket" size="ticket" />
      <PhotoTray photos={[]} reading onRemove={() => undefined} />
      <AddPhotoButton onFiles={() => undefined} />
    </div>
    <AddPhotoButton variant="dashed" onFiles={() => undefined} />
  </>,
)
