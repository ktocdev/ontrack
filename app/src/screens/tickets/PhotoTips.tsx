import type { CSSProperties } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { IconHelpCircle } from '../../components/icons'

/**
 * Photo tips (from the Ops manager's ticket submission guide, OT-78; no board). How to
 * frame a photo so a technician can find the unit: step back for what is around it,
 * and get its ID label and maker in. The guide's example is a real photo of one of the
 * group's bars, which can't ship in the app, so a drawing stands in for it with the
 * guide's two callouts. Opened from beside Add photo and from Add a photo?.
 */
export function PhotoTipsLink({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 flex-none items-center gap-1.5 text-14 font-semibold text-brand transition-colors hover:text-brand-strong ${className}`}
    >
      <IconHelpCircle size={17} />
      Photo tips
    </button>
  )
}

const TIPS = [
  ['Step back.', 'Show what is behind and around the unit, so it is easy to find.'],
  ['Get its labels in.', 'The unit’s ID and the maker’s name should be in the frame.'],
  ['Show the problem too.', 'A second photo of a leak or an error code helps.'],
  ['Safety first.', 'Never open a panel or reach into equipment for a photo.'],
] as const

export function PhotoTipsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Photo tips"
      focusPanel
      description="A photo is the best way to help a technician find the unit. Directions and area nicknames aren’t always clear to someone new to the restaurant."
    >
      <ExampleDrawing />
      <ol className="flex flex-col gap-2.5 text-14 leading-normal text-text-body">
        {TIPS.map(([lead, rest], i) => (
          <li key={lead} className="flex gap-2.5">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-tint text-12 font-bold text-brand-strong">
              {i + 1}
            </span>
            <span>
              <b className="font-semibold text-text">{lead}</b> {rest}
            </span>
          </li>
        ))}
      </ol>
      <Button variant="secondary" className="mt-1" onClick={() => onOpenChange(false)}>
        Got it
      </Button>
    </Sheet>
  )
}

const fill = (token: string): CSSProperties => ({ fill: `var(--${token})` })
const stroke = (token: string): CSSProperties => ({ stroke: `var(--${token})` })

/** A unit under a bar counter, framed as the guide asks, with its two callouts. */
function ExampleDrawing() {
  return (
    <svg
      viewBox="0 0 320 210"
      role="img"
      aria-label="Example photo: the room behind the unit is in the frame, and so are the unit's ID label and maker's plate"
      className="w-full flex-none overflow-hidden rounded-input border border-border"
    >
      {/* The room behind: windows and a table. */}
      <rect width="320" height="210" style={fill('surface-sunken')} />
      {[18, 96, 174, 252].map((x) => (
        <rect
          key={x}
          x={x}
          y="14"
          width="56"
          height="58"
          rx="3"
          style={{ ...fill('surface'), ...stroke('border-strong') }}
        />
      ))}
      <rect x="36" y="80" width="54" height="6" rx="2" style={fill('border-strong')} />
      <rect x="230" y="80" width="54" height="6" rx="2" style={fill('border-strong')} />
      {/* The counter, the unit and a sink beside it. */}
      <rect x="0" y="96" width="320" height="8" style={fill('border-strong')} />
      <rect x="0" y="104" width="320" height="106" style={fill('surface-muted')} />
      <rect
        x="112"
        y="112"
        width="96"
        height="88"
        rx="4"
        style={{ ...fill('surface'), ...stroke('text-muted') }}
        strokeWidth="1.5"
      />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={124 + i * 19} y="176" width="12" height="16" rx="1.5" style={fill('surface-sunken')} />
      ))}
      <rect x="120" y="120" width="20" height="14" rx="2" style={fill('text')} />
      <text x="130" y="131" textAnchor="middle" fontSize="10" fontWeight="700" style={fill('surface')}>
        B1
      </text>
      <rect
        x="150"
        y="122"
        width="40"
        height="10"
        rx="2"
        style={{ ...fill('surface-sunken'), ...stroke('text-muted') }}
      />
      <text x="170" y="130" textAnchor="middle" fontSize="7" fontWeight="700" style={fill('text-muted')}>
        MAKER
      </text>
      <rect x="226" y="116" width="58" height="34" rx="3" style={{ ...fill('surface'), ...stroke('text-muted') }} />
      {/* Callouts, in the guide's blue and yellow. */}
      <rect
        x="6"
        y="6"
        width="308"
        height="86"
        rx="8"
        fill="none"
        strokeWidth="2.5"
        strokeDasharray="7 5"
        style={stroke('info')}
      />
      <rect x="96" y="40" width="128" height="22" rx="11" style={fill('info')} />
      <text x="160" y="55" textAnchor="middle" fontSize="11" fontWeight="700" style={fill('bg')}>
        Where it is
      </text>
      <rect
        x="114"
        y="114"
        width="80"
        height="24"
        rx="6"
        fill="none"
        strokeWidth="2.5"
        strokeDasharray="5 4"
        style={stroke('status-waiting-text')}
      />
      <rect x="30" y="150" width="78" height="22" rx="11" style={fill('status-waiting-text')} />
      <text x="69" y="165" textAnchor="middle" fontSize="11" fontWeight="700" style={fill('bg')}>
        ID + maker
      </text>
      <path d="M108 158 L128 140" strokeWidth="2" strokeLinecap="round" style={stroke('status-waiting-text')} />
    </svg>
  )
}
