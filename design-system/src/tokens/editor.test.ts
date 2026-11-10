import { describe, expect, it } from 'vitest'
import { contrast, parseColor, toOklch } from './color'
import {
  changedVars,
  editCount,
  emptyEdits,
  exportTokensCss,
  follow,
  normalizeEdits,
  overrideCss,
  ramp,
  resolveValue,
} from './editor'
import { SOURCE, TOKEN, TOKENS, TOKENS_SOURCE, defaultBase, sourceIn } from './source'

describe('tokens.css parsing', () => {
  it('reads both themes and the groups', () => {
    expect(TOKEN.get('brand')?.light).toBe('#12634f')
    expect(TOKEN.get('brand')?.dark).toBe('#3ea583')
    expect(TOKEN.get('bg')?.group).toBe('Surfaces')
    expect(TOKEN.get('shadow-raised')?.kind).toBe('shadow')
    expect(TOKEN.get('radius-card')?.kind).toBe('radius')
    expect(TOKENS.length).toBeGreaterThan(80)
  })

  it('puts colors on the ramps they belong to', () => {
    expect(SOURCE.get('brand-tint')).toBe('brand')
    expect(SOURCE.get('text')).toBe('neutral')
    expect(SOURCE.get('urgent')).toBe('danger')
    expect(SOURCE.get('status-progress-text')).toBe('info')
    expect(SOURCE.get('status-waiting-bg')).toBe('warning')
    expect(SOURCE.get('restaurant-porter')).toBe('accent')
    expect(sourceIn('status-open-bg', 'dark')).toBe('derived')
  })
})

describe('with no edits', () => {
  it('changes nothing in either theme', () => {
    const e = emptyEdits()
    expect(changedVars(e, 'light')).toEqual({})
    expect(changedVars(e, 'dark')).toEqual({})
    expect(overrideCss(e)).toBe('')
    expect(editCount(e)).toBe(0)
    expect(exportTokensCss(e)).toBe(TOKENS_SOURCE)
  })
})

describe('moving a ramp', () => {
  const purple = '#5b3a9e'

  it('turns every brand token and nothing else', () => {
    const e = emptyEdits()
    e.light.bases.brand = purple
    const changed = changedVars(e, 'light')
    expect(changed['brand']).toBe(purple)
    expect(changed['brand-tint']).toBeDefined()
    expect(changed['danger']).toBeUndefined()
    expect(changed['text']).toBeUndefined()
    expect(changedVars(e, 'dark')).toEqual({})
    // A tint stays a tint: light, with little chroma.
    const tint = toOklch(parseColor(changed['brand-tint']!)!)
    expect(tint.l).toBeGreaterThan(0.85)
    expect(Math.round(tint.h / 10)).toBe(Math.round(toOklch(parseColor(purple)!).h / 10))
  })

  it('keeps a light edit out of the dark theme', () => {
    const e = emptyEdits()
    e.light.bases.brand = purple
    const css = overrideCss(e)
    expect(css).toMatch(/:root:not\(\[data-theme='dark'\]\) \{[^}]*--brand-fill: #5b3a9e/)
    expect(css).not.toMatch(/^:root \{[^}]*--brand-fill/m)
  })

  it('keeps alpha', () => {
    expect(follow('rgba(21, 32, 27, 0.45)', '#5a645f', '#5e5a6a', 'neutral')).toMatch(/^rgba\(.*0\.45\)$/)
  })

  it('makes a ramp of eleven steps, light to dark', () => {
    const r = ramp(defaultBase('brand', 'light'))
    expect(r).toHaveLength(11)
    const ls = r.map((s) => toOklch(parseColor(s.color)!).l)
    expect([...ls].sort((a, b) => b - a)).toEqual(ls)
  })
})

describe('shape, space and shadow', () => {
  it('scales radii but never the pill', () => {
    const e = emptyEdits()
    e.radiusScale = 0.5
    expect(resolveValue(TOKEN.get('radius-card')!, 'light', e)).toBe('7px')
    expect(resolveValue(TOKEN.get('radius-pill')!, 'light', e)).toBe('999px')
  })

  it('never scales tap targets', () => {
    const e = emptyEdits()
    e.spaceScale = 0.5
    expect(resolveValue(TOKEN.get('tap-min')!, 'light', e)).toBe('44px')
    expect(resolveValue(TOKEN.get('screen-pad')!, 'light', e)).toBe('10px')
    expect(overrideCss(e)).toContain('--spacing: 0.125rem')
  })

  it('scales shadow opacity per theme', () => {
    const e = emptyEdits()
    e.dark.shadowStrength = 0.5
    expect(changedVars(e, 'light')['shadow-raised']).toBeUndefined()
    expect(changedVars(e, 'dark')['shadow-raised']).toBe('0 8px 24px -8px rgba(0, 0, 0, 0.3)')
  })
})

describe('export', () => {
  it('writes edits in place and leaves the rest of the file alone', () => {
    const e = emptyEdits()
    e.light.colors['bg'] = { mode: 'custom', value: '#ffeedd' }
    e.dark.colors['banner-info'] = { mode: 'custom', value: '#223344' }
    const out = exportTokensCss(e)
    expect(out).toContain('--bg: #ffeedd;')
    expect(out).toContain('--banner-info: #223344;')
    expect(out.split('\n').length).toBeGreaterThan(TOKENS_SOURCE.split('\n').length)
    expect(out.replace('--bg: #ffeedd;', '--bg: #f3f4f1;')).toContain(TOKENS_SOURCE.slice(0, 200))
  })

  it('drops what a pasted edit set cannot mean', () => {
    const e = normalizeEdits({
      light: { bases: { brand: 'nope', info: '#123456' }, colors: { nothing: {} } },
      radiusScale: 99,
    })
    expect(e.light.bases).toEqual({ info: '#123456' })
    expect(e.light.colors).toEqual({})
    expect(e.radiusScale).toBe(3)
  })
})

it('measures contrast', () => {
  expect(contrast(parseColor('#000')!, parseColor('#fff')!)).toBeCloseTo(21)
})
