import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { IconHelpCircle } from '../../components/icons'
import example from './photo-tips-example.webp'

/**
 * Photo tips (from the Ops manager's ticket submission guide, OT-78; no board). How to
 * frame a photo so a technician can find the unit: step back for what is around it,
 * and get its ID label and maker in. The guide's example is a real photo of one of the
 * group's bars, which can't ship in the app, so a line drawing made from it stands in.
 * Opened from beside Add photo and from Add a photo?.
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
      <ExamplePhoto />
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

/**
 * A line drawing of a cooler under a bar, made for the app from the guide's photo (Nov 5,
 * 2026), with the guide's blue and yellow boxes drawn in. The labels are text on top, so
 * they stay sharp and are read out; the yellow one sits under the B1 label it points at.
 * In dark mode the white drawing is dimmed a little so it doesn't glare. It is shown no
 * taller than about half the screen, so the tips start close below it.
 */
function ExamplePhoto() {
  return (
    <figure
      className="relative mx-auto flex-none overflow-hidden rounded-input border border-border"
      style={{ width: 'min(100%, calc(44dvh * 896 / 1200))', aspectRatio: '896 / 1200' }}
    >
      <img
        src={example}
        width={896}
        height={1200}
        alt="Example photo: a cooler under a bar, with the room behind it in the frame and its ID label, B1, on the front"
        className="h-full w-full dark:brightness-85"
      />
      <Label className="top-[14%] bg-info">Show where it is</Label>
      <Label className="top-[74%] bg-status-waiting-text">ID + maker in frame</Label>
    </figure>
  )
}

function Label({ className, children }: { className: string; children: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill px-3 py-1 text-13 font-bold text-bg shadow-raised ${className}`}
    >
      {children}
    </span>
  )
}
