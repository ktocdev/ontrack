import type { SVGProps } from 'react'

/**
 * The line icons drawn on the design canvas, as components. Stroke icons take
 * currentColor so they follow text color; size defaults to 24 (tab bars) and
 * can be overridden.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 24, ...rest }: IconProps, strokeWidth = 2, join = true) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: join ? ('round' as const) : undefined,
    'aria-hidden': true,
    ...rest,
  }
}

// Tab bar
export const IconPlusSquare = (p: IconProps) => (
  <svg {...base(p, 2, false)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d="M12 8v8M8 12h8" />
  </svg>
)
export const IconList = (p: IconProps) => (
  <svg {...base(p, 2, false)}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
)
export const IconClipboardCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1M9 11l2 2 4-4M9 17h6" />
  </svg>
)
export const IconWrench = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
  </svg>
)
export const IconDashboard = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
)
export const IconBriefcase = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
  </svg>
)
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c1.9.6 3.1 2.6 3.5 5.5" />
  </svg>
)
export const IconShieldCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
export const IconBuilding = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6" />
  </svg>
)
export const IconStorefront = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    <path d="M5 12v8h14v-8M10 20v-5h4v5" />
  </svg>
)

// Chrome
export const IconChevronLeft = (p: IconProps) => (
  <svg {...base({ size: 22, ...p })}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)
export const IconChevronDown = (p: IconProps) => (
  <svg {...base({ size: 16, ...p })}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const IconClose = (p: IconProps) => (
  <svg {...base({ size: 22, ...p }, 2, false)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const IconSearch = (p: IconProps) => (
  <svg {...base({ size: 18, ...p }, 2, false)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)
export const IconQr = (p: IconProps) => (
  <svg {...base({ size: 22, ...p }, 2, false)}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8" />
  </svg>
)
export const IconPlus = (p: IconProps) => (
  <svg {...base({ size: 20, ...p }, 2.2, false)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconCheck = (p: IconProps) => (
  <svg {...base({ size: 18, ...p }, 2.6)}>
    <path d="m5 12 5 5 9-10" />
  </svg>
)
export const IconEye = (p: IconProps) => (
  <svg {...base({ size: 14, ...p }, 2.2)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconFlag = (p: IconProps) => (
  <svg {...base({ size: 16, ...p }, 2.2)}>
    <path d="M4 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H5" />
  </svg>
)
export const IconClipboardSmall = (p: IconProps) => (
  <svg {...base({ size: 11, ...p }, 2.4)}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1M9 12h6M9 16h4" />
  </svg>
)

// Error screens
export const IconMapLost = (p: IconProps) => (
  <svg {...base({ size: 30, ...p })}>
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
    <path d="M9 4v14M15 6v6" />
    <path d="m14 15 4 4M18 15l-4 4" />
  </svg>
)
export const IconLock = (p: IconProps) => (
  <svg {...base({ size: 30, ...p })}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2" />
  </svg>
)
export const IconServer = (p: IconProps) => (
  <svg {...base({ size: 30, ...p })}>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01M15 7.5h3M15 16.5h3" />
  </svg>
)

// Status icons (13px inside pills), drawn at stroke 2.6 like the canvas masks
const statusBase = (p: IconProps) => base({ size: 13, ...p }, 2.6)
export const IconStatusOpen = (p: IconProps) => (
  <svg {...statusBase(p)}>
    <circle cx="12" cy="12" r="8.5" />
  </svg>
)
export const IconStatusProgress = (p: IconProps) => (
  <svg width={p.size ?? 13} height={p.size ?? 13} viewBox="0 0 32 32" aria-hidden="true" className={p.className}>
    <path
      fill="currentColor"
      d="M16 2a14 14 0 1 0 14 14A14.016 14.016 0 0 0 16 2m0 26a12 12 0 0 1 0-24v12l8.481 8.481A11.96 11.96 0 0 1 16 28"
    />
  </svg>
)
export const IconStatusWaiting = (p: IconProps) => (
  <svg {...statusBase(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
export const IconStatusScheduled = (p: IconProps) => (
  <svg {...statusBase(p)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M8 3v4M16 3v4M8.5 13.5l2.5 2.5 4.5-4.5" />
  </svg>
)
export const IconStatusReopened = (p: IconProps) => (
  <svg {...statusBase(p)}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20.5 3.5v5h-5" />
  </svg>
)
export const IconStatusDone = (p: IconProps) => (
  <svg {...statusBase(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.2 2.5 2.5 4.9-5.2" />
  </svg>
)

/** The OnTrack mark: rounded square in brand green with a white check. */
export const Logo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
    <rect width="28" height="28" rx="8" className="fill-brand-fill" />
    <path d="M8 15l4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
