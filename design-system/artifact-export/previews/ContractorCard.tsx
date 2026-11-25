// @card ContractorCard Contractors 280
import React from 'react'
import { ContractorCard } from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <ContractorCard
      name="Coldline Refrigeration"
      trades={['Refrigeration', 'HVAC']}
      preferred
      contact="Rosa Alvarez"
      visits="11 visits · last Oct 19, 2026"
      spend="$4,812"
      phone="(312) 555-0187"
      to="#"
    />
    <ContractorCard
      name="Brightway Electric"
      trades={['Electrical']}
      warning="Insurance expires Nov 1"
      contact="Tina Nguyen"
      visits="6 visits · last Oct 8, 2026"
      spend="$2,140"
      phone="(773) 555-0133"
    />
  </>,
)
