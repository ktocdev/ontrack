import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { useUser } from '../auth/context'
import { useAvatarUrl } from '../screens/profile/useProfile'

/** The 40px avatar in a screen header that opens Profile; shows the photo once loaded. */
export function ProfileLink() {
  const { user, viewingAs } = useUser()
  const photo = useAvatarUrl(user.avatar_path)
  if (viewingAs) return <Avatar name={user.full_name} role={user.role} src={photo.data} />
  return (
    <Link to="/profile" aria-label="Your profile" className="rounded-full">
      <Avatar name={user.full_name} role={user.role} src={photo.data} />
    </Link>
  )
}
