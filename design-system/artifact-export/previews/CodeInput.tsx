// @card CodeInput Forms 270
import React, { useState } from 'react'
import { CodeInput, StepBars } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [code, setCode] = useState('4829')
  return (
    <>
      <StepBars step={2} />
      <CodeInput id="pv-code" label="Verification code" value={code} onChange={setCode} />
      <CodeInput
        id="pv-backup"
        label="Backup code"
        mode="backup"
        size={26}
        value=""
        onChange={() => undefined}
        error="That code isn't right, or it has been used."
      />
    </>
  )
}
mount(<Demo />)
