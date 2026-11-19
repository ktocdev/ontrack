import type { ReactNode } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useGroupLabel } from '../../auth/group'
import { ReadOnlyBanner } from '../../components/ReadOnlyBanner'
import { ScreenHeader } from '../../components/Screen'

/**
 * The top of leadership's tab screens (Exec-*): READ-ONLY VIEW across the top, then the
 * group's name and the avatar, then the title. Anything under the title goes in children.
 */
export function LeadershipHeader({ title, children }: { title: string; children?: ReactNode }) {
  const group = useGroupLabel()
  return (
    <>
      <ReadOnlyBanner />
      <ScreenHeader
        underBanner
        title={title}
        topLeft={<span className="text-13 font-semibold text-text-secondary">{group}</span>}
        topRight={<ProfileLink />}
      >
        {children}
      </ScreenHeader>
    </>
  )
}
