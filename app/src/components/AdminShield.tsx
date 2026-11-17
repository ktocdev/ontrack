import { Link } from 'react-router'
import { IconShieldCheck } from './icons'

/**
 * The shield beside the avatar on a home screen's header, for someone who holds Admin on
 * top of their role (OT-123; no board draws it). Outlined, it leads to the admin view;
 * filled, the person is in the admin view and it leads back to their home. 44px to tap,
 * with the 40px circle the avatar has.
 */
export function AdminShield({ to, active }: { to: string; active: boolean }) {
  return (
    <Link
      to={to}
      aria-label={active ? 'Leave admin' : 'Admin'}
      aria-current={active ? 'page' : undefined}
      className="flex h-11 w-11 flex-none items-center justify-center rounded-full no-underline"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors active:duration-0 ${
          active
            ? 'bg-brand-fill text-on-brand hover:bg-brand-fill-hover'
            : 'border border-border bg-surface text-text-secondary hover:bg-surface-hover active:bg-surface-sunken'
        }`}
      >
        <IconShieldCheck size={20} />
      </span>
    </Link>
  )
}
