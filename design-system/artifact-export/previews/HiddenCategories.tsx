// @card HiddenCategories Feedback 80
import React, { useState } from 'react'
import { HiddenCategories } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [showAll, setShowAll] = useState(false)
  return <HiddenCategories count={3} showAll={showAll} onShowAll={setShowAll} />
}
mount(<Demo />)
