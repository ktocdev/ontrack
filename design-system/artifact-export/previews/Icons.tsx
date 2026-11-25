// @card Icons Foundations 1230
import React from 'react'
import * as OT from 'ontrack'
import { mount } from './_shared'

const names = Object.keys(OT)
  .filter((k) => /^Icon[A-Z]/.test(k))
  .sort()
mount(
  <>
    <div className="flex items-center gap-4">
      <OT.Logo />
      <OT.BrandMark />
    </div>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
      {names.map((n) => {
        const I = (OT as unknown as Record<string, React.ComponentType<{ size?: number }>>)[n]!
        return (
          <div
            key={n}
            className="flex flex-col items-center gap-1.5 rounded-input border border-border bg-surface px-2 py-3 text-text-body"
          >
            <I size={22} />
            <span className="font-mono text-10 text-text-muted">{n.slice(4)}</span>
          </div>
        )
      })}
    </div>
  </>,
  { width: 'full' },
)
