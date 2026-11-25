// @card ScreenHeader Navigation 510
import React from 'react'
import {
  ScreenHeader,
  BackBar,
  TitleBar,
  CloseBar,
  BrandBackBar,
  UnderlineTabs,
  TabAlert,
  OverflowMenu,
  BackLink,
} from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <ScreenHeader
      title="Open tickets"
      action={<OverflowMenu label="More options" items={[{ to: '#', label: 'View closed tickets' }]} />}
    />
    <UnderlineTabs
      label="Ticket lists"
      items={[
        { to: '/', label: <>Open · 14</>, end: true },
        {
          to: '/closed',
          label: (
            <>
              Closed <TabAlert count={1} label="1 reopened" />
            </>
          ),
        },
      ]}
    />
    <BackBar to="#" label="Equipment" />
    <TitleBar to="#" label="Back" title="Closed tickets" />
    <CloseBar to="#" title="Add restaurant" />
    <CloseBar to="#" title="Log service" subtitle="OT-1042 · Walk-in Cooler 1" bordered={false} />
    <BrandBackBar to="#" label="Back" />
    <div className="px-4 py-2">
      <BackLink to="#" label="Back to dashboard" size={22} />
    </div>
  </>,
  { pad: false },
)
