import { useRef, useState, type ChangeEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { Card, ListCard, ListRowButton, ListRowLink, RowIcon } from '../../components/Card'
import { Input } from '../../components/Field'
import { Notice } from '../../components/Notice'
import { RoleTag } from '../../components/Pill'
import { Screen, ScreenBody, ScreenFooter, SectionLabel, TitleBar } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { IconChevronRight, IconHelpCircle, IconReport, IconSignOut } from '../../components/icons'
import { ROLE_HOME, ROLE_LABEL } from '../../app/roles'
import { useUser } from '../../auth/context'
import type { ThemePreference } from '../../theme/theme'
import { useTheme } from '../../theme/useTheme'
import { PasswordSheet } from './PasswordSheet'
import { ReportSheet } from './ReportSheet'
import { useAvatarUrl, usePhoto, useSaveProfile } from './useProfile'

/**
 * Profile · Your account (design/screens/Profile), any role. Photo, name and
 * phone are the person's own; email, role and restaurants belong to the admin.
 * Then password, theme, help and sign out, with Save changes fixed at the
 * bottom. Two things the board does not draw come from the build plan: the
 * phone field and the theme control. The 2-step row arrives with OT-12.
 */
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ProfileScreen() {
  const { user, restaurants, allRestaurants, signOut } = useUser()
  const { preference, setPreference } = useTheme()
  const [name, setName] = useState(user.full_name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [notice, setNotice] = useState<string | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const save = useSaveProfile()
  const photo = usePhoto()
  const avatarUrl = useAvatarUrl(user.avatar_path)

  const scope = allRestaurants
    ? 'All restaurants'
    : (restaurants.find((r) => r.id === user.home_restaurant_id)?.name ?? restaurants[0]?.name ?? 'No restaurant yet')
  const dirty = name.trim() !== user.full_name || (phone.trim() || null) !== (user.phone ?? null)
  const nameError = name.trim() ? undefined : 'Enter your name.'

  const onSave = () => {
    if (nameError) return
    setNotice(null)
    save.mutate(
      { full_name: name.trim(), phone: phone.trim() || null },
      { onSuccess: () => setNotice('Profile saved.') },
    )
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNotice(null)
    photo.upload.mutate(file)
  }

  const photoBusy = photo.upload.isPending || photo.remove.isPending
  const photoError = photo.upload.isError || photo.remove.isError

  return (
    <Screen>
      <TitleBar to={ROLE_HOME[user.role]} label="Back" title="Profile" />

      <ScreenBody className="gap-3 pb-5 pt-5">
        <div className="flex flex-col items-center gap-2.5">
          <Avatar
            name={user.full_name}
            role={user.role}
            size={88}
            src={avatarUrl.data}
            label={user.avatar_path ? 'Your profile photo' : undefined}
          />
          <div className="flex gap-1">
            <Button
              variant="ghost"
              loading={photo.upload.isPending}
              disabled={photoBusy}
              onClick={() => fileInput.current?.click()}
            >
              {user.avatar_path ? 'Change photo' : 'Upload photo'}
            </Button>
            {user.avatar_path && (
              <Button variant="ghost-danger" disabled={photoBusy} onClick={() => photo.remove.mutate()}>
                Remove
              </Button>
            )}
          </div>
          <span className={`-mt-1.5 text-12 ${photoError ? 'font-semibold text-danger' : 'text-text-muted'}`}>
            {photoError ? "That photo didn't upload. Try a JPG or PNG." : 'Optional · JPG or PNG'}
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onFile}
          />
        </div>

        <Input
          label="Name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={dirty ? nameError : undefined}
        />
        <Input
          label="Phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          hint="Optional. Lets your Ops Manager call you about a ticket."
        />

        <ListCard>
          <div className="flex min-h-[60px] flex-col justify-center gap-[3px] px-3.5 py-2.5">
            <span className="text-12 text-text-muted">Email</span>
            <span className="text-14 font-semibold [overflow-wrap:anywhere]">{user.email}</span>
          </div>
          <div className="flex min-h-[60px] flex-col justify-center gap-[3px] border-t border-border px-3.5 py-2.5">
            <span className="text-12 text-text-muted">Role</span>
            <span className="flex items-center justify-between gap-2">
              <span className="text-14 font-semibold">{scope}</span>
              <RoleTag>{ROLE_LABEL[user.role]}</RoleTag>
            </span>
          </div>
        </ListCard>
        <span className="-mt-1 text-12 text-text-muted">
          Your email, role and restaurants are managed by your admin.
        </span>

        <SectionLabel className="-mb-0.5">Sign-in &amp; security</SectionLabel>
        <Card className="flex min-h-[60px] items-center gap-3 px-3.5 py-2.5">
          <div className="flex flex-1 flex-col gap-[3px]">
            <span className="text-14 font-semibold">Password</span>
            <span className="text-12 text-text-muted">At least 12 characters</span>
          </div>
          <Button variant="ghost" onClick={() => setPwOpen(true)}>
            Change
          </Button>
        </Card>

        {notice && <Notice>{notice}</Notice>}

        <SectionLabel className="-mb-0.5">Appearance</SectionLabel>
        <Segmented label="Theme" value={preference} onChange={setPreference} options={THEME_OPTIONS} />

        <SectionLabel className="-mb-0.5">Help &amp; support</SectionLabel>
        <ListCard>
          <ListRowLink
            to="/profile/help"
            leading={
              <RowIcon>
                <IconHelpCircle />
              </RowIcon>
            }
            title="Help center"
            subtitle="Common questions and ways to reach support"
            trailing={<IconChevronRight className="text-text-muted" />}
          />
          <ListRowButton
            onClick={() => setReportOpen(true)}
            leading={
              <RowIcon>
                <IconReport />
              </RowIcon>
            }
            title="Report a problem"
            subtitle="Something not working? Tell support."
            trailing={<IconChevronRight className="text-text-muted" />}
          />
        </ListCard>

        <div className="pt-3">
          <Button variant="secondary-danger" icon={<IconSignOut />} onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </ScreenBody>

      <ScreenFooter>
        {save.isError && (
          <span role="alert" className="text-13 font-semibold text-danger">
            Couldn&apos;t save. Check your connection and try again.
          </span>
        )}
        <Button onClick={onSave} loading={save.isPending} disabled={!dirty || Boolean(nameError)}>
          Save changes
        </Button>
      </ScreenFooter>

      <PasswordSheet
        open={pwOpen}
        onOpenChange={setPwOpen}
        onDone={() => setNotice('Password updated. Other devices were signed out.')}
      />
      <ReportSheet open={reportOpen} onOpenChange={setReportOpen} />
    </Screen>
  )
}
