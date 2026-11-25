// @card Skeleton Loading 780
import React from 'react'
import {
  ButtonSpinner,
  CardFeedSkeleton,
  DetailSkeleton,
  GroupedListSkeleton,
  PeopleListSkeleton,
  Spinner,
} from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <div className="flex items-center gap-4">
      <Spinner />
      <span className="inline-flex items-center gap-2 rounded-input bg-brand-fill px-4 py-3 text-15 font-bold text-on-brand">
        <ButtonSpinner /> Saving…
      </span>
    </div>
    <CardFeedSkeleton count={1} />
    <GroupedListSkeleton rows={1} groups={1} />
    <PeopleListSkeleton count={2} />
    <DetailSkeleton keys={['Name', 'Brand']} />
  </>,
)
