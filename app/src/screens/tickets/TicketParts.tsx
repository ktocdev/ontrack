import { useState, type ReactNode, type UIEvent } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/Card'
import { PhotoThumb } from '../../components/Photo'
import { SectionLabel } from '../../components/Screen'
import { IconChevronLeft, IconWrench } from '../../components/icons'

/** The pieces every ticket screen shares, for managers and Ops, open and closed. */

/** The bar's shadow once the body has scrolled; spread `onScroll` onto the ScreenBody. */
export function useScrolled() {
  const [scrolled, setScrolled] = useState(false)
  return { scrolled, onScroll: (e: UIEvent<HTMLDivElement>) => setScrolled(e.currentTarget.scrollTop > 2) }
}

/** The top bar: a 44px back target, what sits between, and a shadow once the body scrolls. */
export function TicketBar({
  to,
  label,
  scrolled,
  children,
}: {
  to: string
  label: string
  scrolled: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`relative z-10 flex flex-none items-center gap-1 border-b border-border pb-2 pl-2 pr-3 pt-[calc(12px+var(--safe-top))] transition-shadow ${
        scrolled ? 'shadow-scrolled' : ''
      }`}
    >
      <Link
        to={to}
        aria-label={label}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
      >
        <IconChevronLeft size={22} />
      </Link>
      {children}
    </div>
  )
}

/** The photos on the ticket itself, not on an update; nothing when there are none. */
export function TicketPhotos({
  paths,
  urls,
  onOpen,
}: {
  paths: string[]
  urls: Map<string, string> | undefined
  onOpen: (src: string) => void
}) {
  if (paths.length === 0) return null
  return (
    <div className="flex flex-none flex-wrap gap-2">
      {paths.map((path) => {
        const src = urls?.get(path)
        return (
          <PhotoThumb key={path} size="ticket" src={src} alt="Photo on this ticket" onOpen={() => src && onOpen(src)} />
        )
      })}
    </div>
  )
}

/** The unit the ticket is about, under its label. It opens nothing until Phase 4. */
export function EquipmentCard({
  equipment,
}: {
  equipment: { name: string; brand: string | null; serial: string | null }
}) {
  return (
    <>
      <SectionLabel className="-mb-0.5">Equipment</SectionLabel>
      <Card className="flex flex-none items-center gap-3 rounded-input px-3.5 py-3">
        <IconWrench size={22} className="flex-none text-brand" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-15 font-semibold">{equipment.name}</span>
          {(equipment.brand || equipment.serial) && (
            <span className="text-12 text-text-muted">
              {equipment.brand}
              {equipment.brand && equipment.serial && ' · '}
              {equipment.serial && <span className="font-mono">{equipment.serial}</span>}
            </span>
          )}
        </div>
      </Card>
    </>
  )
}
