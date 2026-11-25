// @card Field Forms 760
import React, { useState } from 'react'
import { Input, Textarea, Select, SearchField, PasswordField, PasswordRules } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [q, setQ] = useState('freezer')
  const [pw, setPw] = useState('kitchen4')
  return (
    <>
      <Input label="Your name" placeholder="First and last" />
      <Input label="Email" type="email" defaultValue="maya.reyes@example.com" readOnly hint="Managed by your admin." />
      <Textarea label="Description" placeholder="What is happening?" />
      <Select label="Contractor company" defaultValue="coldline">
        <option value="coldline">Coldline Refrigeration</option>
        <option value="northstar">Northstar HVAC</option>
      </Select>
      <SearchField label="Search tickets" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} />
      <PasswordField label="Create password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
      <PasswordRules password={pw} />
      <PasswordField label="Confirm password" error="At least 12 characters." />
    </>
  )
}
mount(<Demo />)
