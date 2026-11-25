import React, { type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Frame } from 'ontrack'

/* Sample restaurants: the seed's names, colors from the restaurant tokens. */
export const R = [
  { id: 'a', name: 'Federale’s Logan Square', color: 'var(--restaurant-federales-logan)' },
  { id: 'b', name: 'Federale’s West Loop', color: 'var(--restaurant-federales-west-loop)' },
  { id: 'c', name: 'Ranalli’s Logan Square', color: 'var(--restaurant-ranallis-logan)' },
  { id: 'd', name: 'Porter', color: 'var(--restaurant-porter)' },
]

/** Renders a preview inside the app's Frame (router, toasts, theme), padded as a phone screen. */
export function mount(node: ReactNode, { pad = true, width = 390 }: { pad?: boolean; width?: number | 'full' } = {}) {
  const el = document.getElementById('root')!
  createRoot(el).render(
    <Frame>
      <div
        className={pad ? 'flex flex-col gap-3 bg-bg p-4' : 'flex flex-col bg-bg'}
        style={{ maxWidth: width === 'full' ? undefined : width }}
      >
        {node}
      </div>
    </Frame>,
  )
}

export const Label = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-11 text-text-muted">{children}</span>
)
