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
export const IconEllipsis = (p: IconProps) => (
  <svg {...base(p, 3)}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </svg>
)
export const IconGrip = (p: IconProps) => (
  <svg {...base(p, 2.6)}>
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
  </svg>
)
export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)
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
/** No results: a magnifier with a cross in the lens. */
/** Filter: three lines, each shorter (the equipment list's Filter button). */
export const IconFilter = (p: IconProps) => (
  <svg {...base(p, 2.2, false)}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
)
/** Ticket stub (Empty · equipment tickets). */
export const IconTicket = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
    <path d="M14 6v2M14 11v2M14 16v2" />
  </svg>
)
/** Receipt (Empty · no service yet). */
export const IconReceipt = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
)
/** A page with a folded corner: an invoice on file (service log). */
export const IconFile = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
)
/** Info in a circle (the note on Closed tickets). */
export const IconInfo = (p: IconProps) => (
  <svg {...base(p, 2, false)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
)
/** Paperclip (Add equipment: Manual PDF). */
export const IconPaperclip = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m21 11-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l8-7.9" />
  </svg>
)
export const IconSearchOff = (p: IconProps) => (
  <svg {...base({ size: 18, ...p }, 2, false)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5" />
  </svg>
)
export const IconCheckCircle = (p: IconProps) => (
  <svg {...base({ size: 24, ...p })}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 3 3 5-6" />
  </svg>
)
export const IconWarning = (p: IconProps) => (
  <svg {...base({ size: 24, ...p })}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </svg>
)
export const IconArrowRight = (p: IconProps) => (
  <svg {...base({ size: 20, ...p })}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const IconCamera = (p: IconProps) => (
  <svg {...base({ size: 22, ...p })}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)
export const IconImage = (p: IconProps) => (
  <svg {...base({ size: 24, ...p })}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </svg>
)
export const IconTray = (p: IconProps) => (
  <svg {...base({ size: 30, ...p })}>
    <path d="M3 13h5l1 3h6l1-3h5" />
    <path d="M5.5 5h13L21 13v6H3v-6z" />
  </svg>
)
export const IconReopen = (p: IconProps) => (
  <svg {...base({ size: 20, ...p }, 2.2)}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
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

/** The OnTrack mark: rounded square in brand green with a white check; inverse on a brand cover. */
export const Logo = ({ size = 24, inverse = false }: { size?: number; inverse?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
    <rect width="28" height="28" rx="8" className={inverse ? 'fill-on-brand' : 'fill-brand-fill'} />
    <path
      d="M8 15l4 4 8-9"
      fill="none"
      className={inverse ? 'stroke-brand-fill' : 'stroke-on-brand'}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** The mark and name at the top of the invite screens. */
export const BrandMark = () => (
  <span className="flex items-center gap-2">
    <Logo size={28} />
    <span className="font-display text-20 font-bold">OnTrack</span>
  </span>
)

// Password reset
export const IconClockSmall = (p: IconProps) => (
  <svg {...base({ size: 16, ...p }, 2, false)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l3 2" />
  </svg>
)
export const IconInbox = (p: IconProps) => (
  <svg {...base({ size: 16, ...p })}>
    <path d="M4 4h16v16H4zM4 9h16" />
  </svg>
)

// Invites
export const IconPerson = (p: IconProps) => (
  <svg {...base({ size: 20, ...p })}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  </svg>
)
export const IconUserPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M19 8v6M16 11h6" />
  </svg>
)
export const IconTimer = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2M9 2h6" />
  </svg>
)

// Profile and Help
export const IconHelpCircle = (p: IconProps) => (
  <svg {...base({ size: 16, ...p }, 2.2)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
  </svg>
)
export const IconReport = (p: IconProps) => (
  <svg {...base({ size: 16, ...p }, 2.2)}>
    <path d="M4 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H5" />
  </svg>
)
export const IconMail = (p: IconProps) => (
  <svg {...base({ size: 16, ...p }, 2.2)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)
export const IconPhone = (p: IconProps) => (
  <svg {...base({ size: 16, ...p }, 2.2)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
)
export const IconKey = (p: IconProps) => (
  <svg {...base({ size: 16, ...p }, 2.2)}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.3-9.3M16 7l3 3M14 9l2 2" />
  </svg>
)
export const IconChevronRight = (p: IconProps) => (
  <svg {...base({ size: 16, ...p }, 2.2)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
)
export const IconSignOut = (p: IconProps) => (
  <svg {...base({ size: 18, ...p })}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
  </svg>
)
export const IconPhoneCheck = (p: IconProps) => (
  <svg {...base({ size: 20, ...p })}>
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M10 18h4M9.5 10.5l2 2 3.5-4" />
  </svg>
)
export const IconExternal = (p: IconProps) => (
  <svg {...base({ size: 20, ...p })}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
)
/** Safari's Share: an open box with an arrow out of it (Install the app, on an iPhone). */
export const IconShareIos = (p: IconProps) => (
  <svg {...base({ size: 20, ...p })}>
    <path d="M12 3v12M8 7l4-4 4 4M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
  </svg>
)
export const IconCopy = (p: IconProps) => (
  <svg {...base({ size: 16, ...p })}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </svg>
)
export const IconDownload = (p: IconProps) => (
  <svg {...base({ size: 16, ...p })}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
)
export const IconShieldTick = (p: IconProps) => (
  <svg {...base({ size: 26, ...p })}>
    <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
export const IconShieldAlert = (p: IconProps) => (
  <svg {...base({ size: 24, ...p })}>
    <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
)
export const IconLockSmall = (p: IconProps) => (
  <svg {...base({ size: 24, ...p })}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
