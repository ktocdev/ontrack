import { useLocation } from 'react-router'
import { useGroupLabel, useRoleNames } from '../auth/group'
import { useUser } from '../auth/context'
import { Sidebar, SidebarBrand, SidebarLink, SidebarProfile } from '../components/Sidebar'
import { IconShieldCheck } from '../components/icons'
import { useJobTitleName } from '../screens/jobtitles/useJobTitles'
import { useAvatarUrl } from '../screens/profile/useProfile'
import { useWide } from '../lib/useWide'
import { adminOnTop, inAdminView, ROLE_HOME, tabsFor } from './roles'

/**
 * The signed-in sidebar from 768 px (OT-157; no board draws it): the mark and the group's
 * name, the same tabs the tab bar has (`tabsFor`, so the admin view's under /admin), and
 * who is signed in at the foot, opening Profile. Someone who holds Admin on top of their
 * role gets the shield as a row under the tabs: Admin into the admin view, Leave admin out
 * of it, as the header's shield does on a phone. Under View as it shows the person viewed,
 * with nothing a link and their home tab lit, as the inert tab bar does.
 */
export function AppSidebar() {
  // Not on the page at all on a phone, so its text never doubles the header's.
  return useWide() ? <WideSidebar /> : null
}

function WideSidebar() {
  const { user, viewingAs } = useUser()
  const { pathname } = useLocation()
  const group = useGroupLabel()
  const roleNames = useRoleNames()
  const jobTitle = useJobTitleName()(user.job_title_id)
  const photo = useAvatarUrl(user.avatar_path)
  const tabs = tabsFor(user, pathname)
  const admin = inAdminView(pathname)
  const inert = !!viewingAs

  return (
    <Sidebar
      label={tabs.label}
      header={<SidebarBrand group={group} />}
      footer={
        <SidebarProfile
          to="/profile"
          name={user.full_name}
          role={user.role}
          subtitle={jobTitle ?? roleNames.name(user.role)}
          src={photo.data}
          inert={inert}
        />
      }
    >
      {tabs.items.map(({ to, label, icon, end, also, lightsOn }) => (
        <SidebarLink
          key={to}
          to={to}
          end={end}
          also={also}
          lightsOn={lightsOn}
          icon={icon}
          inert={inert}
          current={inert && !!end}
        >
          {label}
        </SidebarLink>
      ))}
      {!inert && adminOnTop(user) && (
        <div className="mt-3 border-t border-border pt-3">
          <SidebarLink to={admin ? ROLE_HOME[user.role] : '/admin/users'} icon={IconShieldCheck} end={admin}>
            {admin ? 'Leave admin' : 'Admin'}
          </SidebarLink>
        </div>
      )}
    </Sidebar>
  )
}
