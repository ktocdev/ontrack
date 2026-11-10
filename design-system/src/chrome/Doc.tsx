import { useId, useState, type MouseEvent, type ReactNode } from 'react'

/** Building blocks for every docs page. Chrome uses the ds-* palette; examples use the app's tokens. */

export function PageHeader({
  eyebrow,
  title,
  children,
  source,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
  /** The file under app/src the page documents. */
  source?: string | string[]
}) {
  const sources = source ? (Array.isArray(source) ? source : [source]) : []
  return (
    <header className="mb-10 flex flex-col gap-3 border-b border-ds-line pb-8">
      <span className="font-ds-body text-12 font-bold uppercase tracking-[0.08em] text-ds-accent">{eyebrow}</span>
      <h1 className="font-ds-display text-[40px] leading-[1.05] font-bold tracking-[-0.025em] text-ds-ink">{title}</h1>
      {children && <div className="ds-prose max-w-[68ch] text-[17px]">{children}</div>}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {sources.map((s) => (
            <code key={s} className="rounded-tag bg-ds-sunken px-2 py-1 font-ds-mono text-12 text-ds-muted">
              app/src/{s}
            </code>
          ))}
        </div>
      )}
    </header>
  )
}

export function Section({
  title,
  id,
  children,
  intro,
}: {
  title: string
  id?: string
  children: ReactNode
  intro?: ReactNode
}) {
  const anchor = id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return (
    <section id={anchor} className="mb-14 scroll-mt-20" aria-labelledby={`${anchor}-h`}>
      <h2 id={`${anchor}-h`} className="mb-2 font-ds-display text-24 font-bold tracking-[-0.01em] text-ds-ink">
        <a href={`#${anchor}`} className="text-ds-ink! hover:text-ds-accent!">
          {title}
        </a>
      </h2>
      {intro && <div className="ds-prose mb-5 max-w-[68ch]">{intro}</div>}
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

/** Links inside an example point at app routes, which do not exist here. */
const stayHere = (e: MouseEvent) => {
  const a = (e.target as HTMLElement).closest('a')
  if (a && !a.getAttribute('href')?.startsWith('#ds-')) e.preventDefault()
}

/**
 * A live example on the app's own canvas. `phone` holds it to the 390px frame of the
 * boards; `bare` drops the padding for full-bleed pieces (headers, tab bars).
 */
export function Example({
  title,
  caption,
  children,
  code,
  width = 'phone',
  bare = false,
  surface = false,
}: {
  title?: string
  caption?: ReactNode
  children: ReactNode
  code?: string
  width?: 'phone' | 'full'
  bare?: boolean
  surface?: boolean
}) {
  const [showCode, setShowCode] = useState(false)
  const codeId = useId()
  return (
    <figure className="m-0 overflow-hidden rounded-card border border-ds-line bg-ds-panel">
      {(title || code) && (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-ds-line px-4 py-2">
          <span className="font-ds-body text-13 font-semibold text-ds-ink-soft">{title}</span>
          {code && (
            <button
              type="button"
              aria-expanded={showCode}
              aria-controls={codeId}
              onClick={() => setShowCode((v) => !v)}
              className="rounded-chip px-2.5 py-1.5 font-ds-body text-12 font-semibold text-ds-muted hover:bg-ds-sunken hover:text-ds-ink"
            >
              {showCode ? 'Hide code' : 'Code'}
            </button>
          )}
        </div>
      )}
      <div
        onClickCapture={stayHere}
        className={`ds-canvas ${surface ? 'bg-surface!' : ''} ${bare ? '' : 'px-4 py-6 sm:px-8'}`}
      >
        <div className={`${width === 'phone' ? 'mx-auto max-w-[390px]' : ''} flex flex-col gap-3`}>{children}</div>
      </div>
      {code && showCode && (
        <pre
          id={codeId}
          className="m-0 overflow-x-auto border-t border-ds-line bg-ds-sunken px-4 py-3 font-ds-mono text-12 leading-[1.6] text-ds-ink"
        >
          <code>{code.trim()}</code>
        </pre>
      )}
      {caption && (
        <figcaption className="border-t border-ds-line px-4 py-2.5 font-ds-body text-13 text-ds-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="m-0 overflow-x-auto rounded-input border border-ds-line bg-ds-sunken px-4 py-3 font-ds-mono text-12 leading-[1.6] text-ds-ink">
      <code>{children.trim()}</code>
    </pre>
  )
}

export type PropRow = { name: string; type: string; default?: string; children: ReactNode }

export function Props({ rows }: { rows: PropRow[] }) {
  return (
    <div className="overflow-x-auto rounded-input border border-ds-line">
      <table className="w-full border-collapse font-ds-body text-13">
        <thead>
          <tr className="bg-ds-sunken text-left text-ds-muted">
            <th className="px-3 py-2 font-semibold">Prop</th>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 font-semibold">Default</th>
            <th className="px-3 py-2 font-semibold">What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-ds-line align-top">
              <td className="px-3 py-2.5 font-ds-mono text-12 font-medium whitespace-nowrap text-ds-ink">{r.name}</td>
              <td className="px-3 py-2.5 font-ds-mono text-12 text-ds-muted">{r.type}</td>
              <td className="px-3 py-2.5 font-ds-mono text-12 text-ds-muted">{r.default ?? '—'}</td>
              <td className="px-3 py-2.5 text-ds-ink-soft">{r.children}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Do and don't, from the boards and the phone rules. */
export function Rules({ dos, donts }: { dos: ReactNode[]; donts?: ReactNode[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <RuleList tone="do" items={dos} />
      {donts && donts.length > 0 && <RuleList tone="dont" items={donts} />}
    </div>
  )
}

function RuleList({ tone, items }: { tone: 'do' | 'dont'; items: ReactNode[] }) {
  return (
    <div
      className={`rounded-input border border-ds-line bg-ds-panel p-4 border-t-4 ${tone === 'do' ? 'border-t-ds-ok' : 'border-t-ds-warn'}`}
    >
      <h3 className={`mb-2 font-ds-body text-13 font-bold ${tone === 'do' ? 'text-ds-ok' : 'text-ds-warn'}`}>
        {tone === 'do' ? 'Do' : 'Don’t'}
      </h3>
      <ul className="ds-prose m-0 flex list-disc flex-col gap-1.5 pl-5 text-14">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/** A token name with a live swatch, for prose and tables. */
export function TokenRef({ name, swatch = false }: { name: string; swatch?: boolean }) {
  return (
    <code className="inline-flex items-center gap-1.5">
      {swatch && (
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 rounded-square shadow-[inset_0_0_0_1px_var(--ds-line-strong)]"
          style={{ background: `var(--${name})` }}
        />
      )}
      --{name}
    </code>
  )
}
