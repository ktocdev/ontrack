import type { ReactNode } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useGroupLabel } from '../../auth/group'
import { ScreenHeader } from '../../components/Screen'

/**
 * The top of leadership's tab screens (Exec-*): the group's name and the avatar, then the
 * title, with `action` beside it (New ticket on the Overview, OT-170). Anything under the
 * title goes in children. The boards' READ-ONLY VIEW band came off (from feedback, Nov 24,
 * 2026): leadership files tickets and posts in threads, and nothing else looks changeable.
 */
export function LeadershipHeader({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children?: ReactNode
}) {
  const group = useGroupLabel()
  return (
    <>
      <ScreenHeader
        title={title}
        topLeft={<span className="text-13 font-semibold text-text-secondary">{group}</span>}
        topRight={<ProfileLink />}
        action={action}
      >
        {children}
      </ScreenHeader>
    </>
  )
}
