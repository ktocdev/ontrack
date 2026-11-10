import { Link } from 'react-router'
import { Button } from '@app/components/Button'
import { StatusPill } from '@app/components/Pill'
import { TicketCard } from '@app/components/TicketCard'
import { Code, Example, PageHeader, Section } from '../chrome/Doc'
import { useTokens } from '../tokens/store'
import { TOKENS } from '../tokens/source'
import { NAV } from './registry'

export function Overview() {
  const { setPanelOpen } = useTokens()
  const colors = TOKENS.filter((t) => t.kind === 'color').length
  return (
    <>
      <PageHeader eyebrow="OnTrack" title="Design system">
        <p>
          The tokens, components and rules behind OnTrack, a phone-first app for equipment and repair tickets. Every
          example on these pages is the app&apos;s own component, rendered from <code>app/src/components</code> with the
          values in <code>app/src/styles/tokens.css</code>, so what you see here is what ships.
        </p>
      </PageHeader>

      <Example title="The pieces together" width="phone">
        <TicketCard
          to="#"
          displayId="OT-1042"
          title="Walk-in cooler not holding temp"
          status="in_progress"
          walkthrough
          place="Back of House · Refrigeration · Walk-in Cooler 1"
          who="Bert Velilla is on it"
          when="Updated 1h ago"
        />
        <div className="flex flex-wrap gap-2">
          <StatusPill status="open" />
          <StatusPill status="waiting_parts" />
          <StatusPill status="closed" />
        </div>
        <Button>Create ticket</Button>
      </Example>

      <Section title="How it fits together" id="how">
        <ol className="ds-prose m-0 flex list-decimal flex-col gap-2 pl-5">
          <li>
            <b>The boards</b> in <code>design/screens/</code> are the source. A screen matches its PNG; it is not
            reinterpreted.
          </li>
          <li>
            <b>Tokens</b> come from <code>design/tokens.md</code> into <code>tokens.css</code>: {colors} colors plus
            radii, shadows and layout sizes, each a CSS variable, with dark values beside the light ones.
          </li>
          <li>
            <b>Tailwind</b> maps them onto utilities (<code>bg-surface</code>, <code>text-text-muted</code>,{' '}
            <code>rounded-card</code>), so switching <code>data-theme</code> recolors everything with no rebuild.
          </li>
          <li>
            <b>Components</b> in <code>app/src/components</code> are built once and used everywhere; a new one goes on
            the app&apos;s <code>/kit</code> page first, in both themes.
          </li>
        </ol>
        <Code>{`<button className="h-[52px] rounded-input bg-brand-fill text-on-brand">Save</button>
/*            never #12634f in app code: add or use a token instead */`}</Code>
      </Section>

      <Section title="Try a theme" id="editor">
        <p className="ds-prose m-0 max-w-[68ch]">
          The token editor changes the app&apos;s tokens on every page here: color ramps, fonts, corner radius, shadow
          and spacing strength. Light and dark are edited separately; switch the theme at the top to edit the other.
          When it looks right, Export writes a <code>tokens.css</code> to drop into the app.
        </p>
        <div>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="h-11 rounded-[10px] bg-ds-accent px-5 text-14 font-semibold text-ds-on-accent hover:opacity-90"
          >
            Open the token editor
          </button>
        </div>
      </Section>

      <Section title="Contents" id="contents">
        <div className="grid gap-6 sm:grid-cols-2">
          {NAV.filter((g) => g.title !== 'Start').map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 font-ds-body text-12 font-bold tracking-[0.08em] text-ds-muted uppercase">
                {g.title}
              </h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {g.pages.map((p) => (
                  <li key={p.path} className="text-14">
                    <Link to={p.path} className="font-semibold text-ds-accent!">
                      {p.title}
                    </Link>
                    <span className="text-ds-muted"> · {p.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
