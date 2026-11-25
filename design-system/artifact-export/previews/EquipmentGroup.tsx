// @card EquipmentGroup Equipment 410
import React, { useState } from 'react'
import { EquipmentGroup, EquipmentRow, OpenBadge, OpenNote } from 'ontrack'
import { mount, R } from './_shared'

function Demo() {
  const [group, setGroup] = useState<string | null>('Refrigeration')
  const flip = (g: string) => setGroup((x) => (x === g ? null : g))
  return (
    <>
      <EquipmentGroup
        name="Refrigeration"
        count={3}
        openCount={1}
        open={group === 'Refrigeration'}
        onToggle={() => flip('Refrigeration')}
      >
        <EquipmentRow
          to="#"
          name="Walk-in Cooler 1"
          restaurant={R[0]}
          brand="Kolpak"
          serial="KP-7XW-220418"
          spend={{ amount: '$860.90', year: 2026 }}
          openCount={1}
        />
        <EquipmentRow
          to="#"
          name="Reach-in Freezer"
          restaurant={R[3]}
          brand="True"
          serial="TR-23F-118204"
          spend={{ amount: null, year: 2026 }}
        />
        <EquipmentRow to="#" name="Walk-in Freezer" brand="Kolpak" serial="KP-9FZ-190233" />
      </EquipmentGroup>
      <EquipmentGroup
        name="Plumbing"
        count={8}
        openCount={0}
        open={group === 'Plumbing'}
        onToggle={() => flip('Plumbing')}
      >
        <EquipmentRow name="Floor Drain Pump" brand="Zoeller" serial="ZL-M53-70188" />
      </EquipmentGroup>
      <div className="flex flex-wrap items-center gap-2">
        <OpenBadge count={1} />
        <OpenBadge count={1} compact />
        <OpenNote count={1} />
      </div>
    </>
  )
}
mount(<Demo />)
