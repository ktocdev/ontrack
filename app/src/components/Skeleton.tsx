import type { CSSProperties, ReactNode } from 'react'

/**
 * Loading placeholders from the design's Loading boards. Every skeleton sits
 * inside a role="status" wrapper with a visually hidden sentence, and the
 * shimmer stops under prefers-reduced-motion.
 */

type SkProps = { w?: number | string; h?: number; r?: number | string; className?: string; style?: CSSProperties }

/** One shimmering bar. `r` is the radius; 999 for pill shapes, '50%' for circles. */
export function Sk({ w = '100%', h = 12, r = 6, className = '', style }: SkProps) {
  return (
    <span
      aria-hidden="true"
      className={`sk block ${className}`}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  )
}

export function LoadingRegion({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div role="status" className={`relative ${className}`}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/** Centered spinner (invite check, QR lookup): 48px ring, brand on brand-tint. */
export function Spinner({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`spin block rounded-full border-brand-tint border-t-brand ${className}`}
      style={{ width: size, height: size, borderWidth: size >= 40 ? 4 : 3 }}
    />
  )
}

/** Inline spinner for a busy primary button: white ring on the green. */
export function ButtonSpinner({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="spin block rounded-full border-[3px] border-white/35 border-t-white"
      style={{ width: size, height: size }}
    />
  )
}

/** Ops dashboard: a feed of ticket cards. */
export function CardFeedSkeleton({ count = 4 }: { count?: number }) {
  const titles = ['78%', '62%', '84%', '58%', '70%']
  const metas = ['46%', '52%', '40%', '56%', '48%']
  return (
    <LoadingRegion label="Loading open tickets" className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-3.5"
        >
          <div className="flex items-center gap-2">
            <Sk w={64} h={12} className="sk-on-card" />
            <span className="flex-1" />
            <Sk w={88} h={22} r={999} className="sk-on-card" />
          </div>
          <Sk w={titles[i % titles.length]} h={16} className="sk-on-card" />
          <Sk w={metas[i % metas.length]} h={12} className="sk-on-card" />
        </div>
      ))}
    </LoadingRegion>
  )
}

/** Equipment list: one open group with rows, then collapsed group heads. */
export function GroupedListSkeleton({ rows = 3, groups = 4 }: { rows?: number; groups?: number }) {
  const widths = [
    ['58%', '40%'],
    ['44%', '36%'],
    ['66%', '42%'],
  ]
  const heads = [96, 72, 112, 84]
  return (
    <LoadingRegion label="Loading equipment" className="flex flex-col gap-2.5">
      <div aria-hidden="true" className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex min-h-[52px] items-center gap-2.5 px-3.5">
          <Sk w={108} h={14} className="sk-on-card" />
          <span className="flex-1" />
          <Sk w={18} h={12} className="sk-on-card" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex min-h-[60px] items-center gap-3 border-t border-surface-muted px-3.5 py-2">
            <div className="flex flex-1 flex-col gap-[7px]">
              <Sk w={widths[i % widths.length][0]} h={14} className="sk-on-card" />
              <Sk w={widths[i % widths.length][1]} h={11} className="sk-on-card" />
            </div>
          </div>
        ))}
      </div>
      {Array.from({ length: groups }).map((_, i) => (
        <div key={i} aria-hidden="true" className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="flex min-h-[52px] items-center gap-2.5 px-3.5">
            <Sk w={heads[i % heads.length]} h={14} className="sk-on-card" />
            <span className="flex-1" />
            <Sk w={18} h={12} className="sk-on-card" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  )
}

/** Equipment detail: a photo box, then labelled rows with value bars. */
export function DetailSkeleton({ keys }: { keys: string[] }) {
  const widths = [120, 80, 140, 160, 150, 90, 170, 110]
  return (
    <>
      <div
        aria-hidden="true"
        className="box flex items-center gap-4 rounded-card border border-border bg-surface p-3.5"
      >
        <Sk w={92} h={92} r={8} className="sk-on-card flex-none" />
        <div className="flex flex-1 flex-col gap-2.5">
          <Sk w={90} h={11} className="sk-on-card" />
          <Sk w={140} h={15} className="sk-on-card" />
          <Sk w={110} h={14} className="sk-on-card" />
        </div>
      </div>
      <LoadingRegion label="Loading details" className="mt-3.5">
        {keys.map((k, i) => (
          <div key={k} className="flex min-h-[45px] items-center justify-between gap-4 border-b border-surface-muted">
            <span className="text-14 text-text-muted">{k}</span>
            <Sk w={widths[i % widths.length]} h={14} />
          </div>
        ))}
      </LoadingRegion>
    </>
  )
}

/** Admin users: avatar circle plus two lines, in one card. */
export function PeopleListSkeleton({ count = 7 }: { count?: number }) {
  const widths = [
    ['46%', '62%'],
    ['38%', '54%'],
    ['52%', '58%'],
    ['42%', '66%'],
  ]
  return (
    <LoadingRegion label="Loading users">
      <div aria-hidden="true" className="overflow-hidden rounded-card border border-border bg-surface">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[66px] items-center gap-3 border-t border-surface-muted px-3.5 py-3 first:border-t-0"
          >
            <Sk w={38} h={38} r="50%" className="sk-on-card flex-none" />
            <div className="flex flex-1 flex-col gap-2">
              <Sk w={widths[i % widths.length][0]} h={14} className="sk-on-card" />
              <Sk w={widths[i % widths.length][1]} h={11} className="sk-on-card" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

/** Leadership overview: four KPI tiles, then per-restaurant rows with a bar. */
export function MetricsSkeleton() {
  const kpis = [
    [36, 84],
    [24, 52],
    [104, 96],
    [80, 110],
  ]
  const names = ['56%', '48%', '60%', '30%']
  const bars = ['72%', '44%', '88%', '36%']
  return (
    <LoadingRegion label="Loading overview" className="flex flex-col gap-3">
      <div aria-hidden="true" className="grid grid-cols-2 gap-2">
        {kpis.map(([a, b], i) => (
          <div key={i} className="flex min-w-0 flex-col gap-2.5 rounded-input border border-border bg-surface p-3.5">
            <Sk w={a} h={24} className="sk-on-card" />
            <Sk w={b} h={11} className="sk-on-card" />
          </div>
        ))}
      </div>
      <span className="eyebrow">By restaurant</span>
      <div aria-hidden="true" className="overflow-hidden rounded-input border border-border bg-surface">
        {names.map((n, i) => (
          <div key={i} className="flex flex-col gap-[9px] border-t border-surface-muted p-3.5 first:border-t-0">
            <div className="flex justify-between">
              <Sk w={n} h={14} className="sk-on-card" />
              <Sk w={64} h={14} className="sk-on-card" />
            </div>
            <Sk w={bars[i]} h={8} className="sk-on-card" />
            <Sk w={90} h={11} className="sk-on-card" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}
