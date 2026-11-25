// @card MonthStepper Figures 90
import React, { useState } from 'react'
import { MonthStepper } from 'ontrack'
import { mount } from './_shared'

const MONTHS = ['2026-09-01', '2026-10-01', '2026-11-01']
function Demo() {
  const [month, setMonth] = useState('2026-10-01')
  const i = MONTHS.indexOf(month)
  return (
    <MonthStepper month={month} line="1 of 4 submitted" older={MONTHS[i - 1]} newer={MONTHS[i + 1]} onGo={setMonth} />
  )
}
mount(<Demo />)
