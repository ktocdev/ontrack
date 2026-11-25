// @card Avatar People 220
import React from 'react'
import { Avatar } from 'ontrack'
import { mount, Label } from './_shared'

mount(
  <>
    <div className="flex flex-wrap items-end gap-4">
      {(['manager', 'ops', 'leadership', 'you', 'pending', 'expired'] as const).map((role) => (
        <span key={role} className="flex flex-col items-center gap-1.5">
          <Avatar
            name={role === 'pending' ? 'Sam Patel' : role === 'expired' ? 'Jordan Blake' : 'Maya Reyes'}
            role={role}
          />
          <Label>{role}</Label>
        </span>
      ))}
    </div>
    <div className="flex flex-wrap items-end gap-4">
      {([28, 30, 38, 40, 52, 88] as const).map((size) => (
        <span key={size} className="flex flex-col items-center gap-1.5">
          <Avatar name="Bert Velilla" role="ops" size={size} />
          <Label>{size}</Label>
        </span>
      ))}
    </div>
  </>,
  { width: 'full' },
)
