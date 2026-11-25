// @card ListCard Lists 540
import React from 'react'
import {
  Avatar,
  Card,
  CategoryTile,
  DisclosureList,
  KeyValueRow,
  ListCard,
  ListRow,
  ListRowButton,
  ListRowLink,
  RoleTag,
  RowIcon,
  StackedRow,
  IconChevronRight,
  IconHelpCircle,
  useToast,
} from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const toast = useToast()
  return (
    <>
      <ListCard>
        <ListRow
          leading={<Avatar name="Sam Patel" role="pending" />}
          title="Sam Patel"
          subtitle="Invite pending · sent 2 days ago"
          trailing={<RoleTag>Manager</RoleTag>}
        />
        <ListRowLink
          to="#"
          leading={<Avatar name="Bert Velilla" role="ops" />}
          title="Bert Velilla"
          subtitle="All restaurants"
          trailing={<RoleTag>Ops Manager</RoleTag>}
        />
        <ListRowButton
          onClick={() => toast.show('Row pressed.')}
          leading={
            <RowIcon>
              <IconHelpCircle />
            </RowIcon>
          }
          title="Help center"
          subtitle="Common questions and ways to reach support"
          trailing={<IconChevronRight className="text-text-muted" />}
        />
      </ListCard>
      <DisclosureList label="Archived contractors" heading="Archived · 2">
        <ListRow title="Lakeview Plumbing" subtitle="Plumbing" />
        <ListRow title="Old Town Signs" subtitle="Decorations · Lighting" />
      </DisclosureList>
      <Card className="px-3.5">
        <KeyValueRow label="Brand">Kolpak</KeyValueRow>
        <KeyValueRow label="Serial number">
          <span className="font-mono">KP-7XW-220418</span>
        </KeyValueRow>
        <StackedRow label="Location">Back of House · Walk-in</StackedRow>
      </Card>
      <div className="grid grid-cols-2 gap-2.5">
        <CategoryTile to="#" name="Refrigeration" count={9} />
        <CategoryTile to="#" name="Plumbing" count={8} />
      </div>
    </>
  )
}
mount(<Demo />)
