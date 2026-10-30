import type { ReactNode } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { ScreenHeader } from '../../components/Screen'
import { useGroupLabel } from '../../auth/group'

/**
 * Header for the admin tabs (Admin-Users, Admin-Restaurants): the two-line
 * "Admin / group name" eyebrow, the profile avatar, the 30px title and an
 * action beside it. The boards leave the avatar out; it stays so admins can
 * reach Profile, as every other role can.
 */
export function AdminHeader({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) {
  const group = useGroupLabel()
  return (
    <ScreenHeader
      title={title}
      action={action}
      topLeft={
        <span className="eyebrow leading-[1.5]">
          Admin
          <br />
          {group || ' '}
        </span>
      }
      topRight={<ProfileLink />}
    >
      {children}
    </ScreenHeader>
  )
}
