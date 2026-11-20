import { Link, useLocation } from 'react-router'
import { AdminShield } from '../components/AdminShield'
import { Avatar } from '../components/Avatar'
import { useUser } from '../auth/context'
import { useAvatarUrl } from '../screens/profile/useProfile'
import { adminOnTop, inAdminView, ROLE_HOME } from './roles'

/**
 * The 40px avatar in a screen header that opens Profile; shows the photo once loaded. On a
 * home screen, someone who holds Admin on top of their role also gets the shield to its
 * left (OT-123): it opens the admin view, and filled there, leads back home. A plain Admin
 * account lives in the admin view, so it has none; nor does anyone under View as, nor a
 * screen that passes `shield={false}`. From 768 px the sidebar's foot and shield row stand
 * in for both, so neither shows here.
 */
export function ProfileLink({ shield = true }: { shield?: boolean }) {
  const { user, viewingAs } = useUser()
  const { pathname } = useLocation()
  const photo = useAvatarUrl(user.avatar_path)
  // From 768 px the sidebar has the avatar and the shield (OT-157), so the header doesn't.
  if (viewingAs) return <Avatar name={user.full_name} role={user.role} src={photo.data} className="md:hidden" />
  const admin = inAdminView(pathname)
  return (
    <span className="flex items-center gap-1.5 md:hidden">
      {shield && adminOnTop(user) && <AdminShield to={admin ? ROLE_HOME[user.role] : '/admin/users'} active={admin} />}
      <Link to="/profile" aria-label="Your profile" className="rounded-full">
        <Avatar name={user.full_name} role={user.role} src={photo.data} />
      </Link>
    </span>
  )
}
