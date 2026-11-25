// @card AccentPicker Restaurants 180
import React, { useState } from 'react'
import { AccentPicker } from 'ontrack'
import { mount } from './_shared'

const KEYS = ['ocean', 'brick', 'walnut', 'olive', 'slate', 'plum', 'charcoal']
const read = (k: string) => getComputedStyle(document.documentElement).getPropertyValue(`--preset-${k}`).trim()

function Demo() {
  const options = KEYS.map((k) => ({ value: read(k), label: k[0]!.toUpperCase() + k.slice(1) }))
  const [value, setValue] = useState(options[0]!.value)
  const [custom, setCustom] = useState('#4d7c0f')
  return (
    <AccentPicker
      label="Accent color"
      hint="Presets come from the --preset-* tokens."
      options={options}
      value={value}
      onChange={setValue}
      custom={custom}
      onCustomChange={setCustom}
      warning={/^#[0-9a-f]{6}$/i.test(custom) ? undefined : 'Enter a 6-digit hex code, like #C2185B.'}
    />
  )
}
mount(<Demo />)
