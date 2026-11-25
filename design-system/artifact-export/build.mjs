// Builds the OnTrack Design System artifact's files from the app.
//   cd design-system && node artifact-export/build.mjs <out>/project
// Writes components/ (bundle, stylesheet, React 19, types, one preview per card), fonts/ and tokens.json.
// Copies static/ (README.md, the Logos note, the cover) over it. Then: node artifact-export/readmes.mjs <out>/project
// for the component READMEs. The index (design-system.json) is written when publishing, since it names the uploaded logos.
import { build } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve, basename } from 'node:path'
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { makeTokens } from './tokens.mjs'

const HERE = import.meta.dirname
const APP = resolve(HERE, '../../app/src')
const OUT = resolve(process.argv[2])
const TMP = resolve(HERE, '.tmp')
const CMP = resolve(OUT, 'components')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(resolve(CMP, 'lib'), { recursive: true })
mkdirSync(resolve(TMP, 'previews'), { recursive: true })

/** Card → the app file it documents. */
const SOURCE = {
  Button: 'Button',
  StatusPill: 'Pill',
  RestaurantName: 'RestaurantName',
  RestaurantPicker: 'RestaurantPicker',
  AccentPicker: 'AccentPicker',
  ReorderList: 'ReorderList',
  Avatar: 'Avatar',
  ListCard: 'Card',
  Field: 'Field',
  CodeInput: 'CodeInput',
  CostCard: 'Cost',
  Segmented: 'Segmented',
  Chip: 'Chip',
  RadioCard: 'RadioCard',
  Switch: 'Switch',
  ViewSettingFields: 'ViewSetting',
  ThemeControl: 'ThemeControl',
  ScreenHeader: 'Screen',
  TabBar: 'TabBar',
  Sidebar: 'Sidebar',
  AdminShield: 'AdminShield',
  Notice: 'Notice',
  Toast: 'Toast',
  EmptyState: 'EmptyState',
  UpdateBar: 'UpdateBar',
  HiddenCategories: 'HiddenCategories',
  Sheet: 'Sheet',
  InstallSheet: 'InstallSheet',
  OverflowMenu: 'Menu',
  StatusMenu: 'StatusMenu',
  TicketCard: 'TicketCard',
  OpsTicketCard: 'OpsTicketCard',
  RestaurantGroup: 'RestaurantGroup',
  ClosedTicketRow: 'ClosedTicketRow',
  ThreadMessage: 'Thread',
  PhotoThumb: 'Photo',
  EquipmentGroup: 'Equipment',
  TaskRow: 'TaskRow',
  ContractorCard: 'ContractorCard',
  Kpi: 'Kpi',
  MonthStepper: 'MonthStepper',
  ReadOnlyBanner: 'ReadOnlyBanner',
  ProgressBar: 'Walkthrough',
  ChecklistGroup: 'Checklist',
  RotationMonthRow: 'Schedule',
  Skeleton: 'Skeleton',
  Icons: 'icons',
}

const define = { 'process.env.NODE_ENV': '"production"', __APP_VERSION__: '"design-system"', __E2E_MOCK__: 'false' }
const base = {
  configFile: false,
  logLevel: 'error',
  publicDir: false,
  define,
  resolve: {
    alias: { '@app': APP },
    dedupe: [
      'react-router',
      'radix-ui',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/modifiers',
      '@dnd-kit/utilities',
    ],
  },
}
/** Bare 'react' / 'react-dom' imports read the page's globals, so CommonJS packages that require them work too. */
const GLOBALS = { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', ontrack: 'OnTrack' }
const globalsShim = (names) => ({
  name: 'globals-shim',
  enforce: 'pre',
  resolveId: (id) => (names.includes(id) ? '\0g:' + id : null),
  load: (id) => (id.startsWith('\0g:') ? `module.exports = window.${GLOBALS[id.slice(3)]};` : null),
})
const lib = (entry, name, outDir, fileName, external, globals, extra = {}) =>
  build({
    ...base,
    ...extra,
    plugins: [globalsShim(external), ...(extra.plugins ?? [])],
    build: {
      outDir,
      emptyOutDir: false,
      minify: true,
      cssMinify: false,
      assetsInlineLimit: 0,
      lib: { entry, formats: ['iife'], name, fileName: () => fileName, cssFileName: 'bundle' },
    },
  })

/** Non-ASCII as \u escapes, so the scripts read the same in a frame of any encoding. */
const ascii = (t) => t.replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

// 1. Split the preview sources into one file per card.
const cards = []
for (const f of readdirSync(resolve(HERE, 'previews'))) {
  const text = readFileSync(resolve(HERE, 'previews', f), 'utf8')
  if (f.startsWith('_')) {
    writeFileSync(resolve(TMP, 'previews', f), text)
    continue
  }
  for (const part of text.split(/^\/\/ @card /m).slice(1)) {
    const [head, ...rest] = part.split('\n')
    const [name, group, height] = head.trim().split(/\s+/)
    writeFileSync(resolve(TMP, 'previews', `${name}.tsx`), rest.join('\n'))
    cards.push({ name, group, height: +height })
  }
}
const missing = cards.filter((c) => !SOURCE[c.name])
if (missing.length) throw new Error('no source for ' + missing.map((c) => c.name))

// 2. Type-check the previews against the bundle entry, and emit the components' declarations.
writeFileSync(
  resolve(TMP, 'tsconfig.json'),
  JSON.stringify({
    extends: '../../tsconfig.app.json',
    compilerOptions: {
      paths: {
        '@app/*': ['../../../app/src/*'],
        react: ['../../node_modules/@types/react'],
        'react/*': ['../../node_modules/@types/react/*'],
        'react-dom': ['../../node_modules/@types/react-dom'],
        'react-dom/*': ['../../node_modules/@types/react-dom/*'],
        'react-router': ['../../node_modules/react-router'],
        'radix-ui': ['../../node_modules/radix-ui'],
        ontrack: ['../entry.tsx'],
      },
      noUnusedLocals: false,
    },
    include: ['previews/*.tsx', '../../../app/src/vite-env.d.ts'],
  }),
)
try {
  execSync('npx tsc -p artifact-export/.tmp/tsconfig.json', { cwd: resolve(HERE, '..'), stdio: 'pipe' })
} catch (e) {
  console.error(String(e.stdout))
  throw new Error('previews do not type-check')
}
execSync('npx tsc -p artifact-export/tsconfig.dts.json', { cwd: resolve(HERE, '..'), stdio: 'inherit' })

// 3. React 19 as classic scripts.
await lib(resolve(HERE, 'libs/react.js'), 'ReactLib', resolve(CMP, 'lib'), 'react.js', [], {})
await lib(resolve(HERE, 'libs/react-dom.js'), 'ReactDomLib', resolve(CMP, 'lib'), 'react-dom.js', ['react'], {
  react: 'React',
})

// 4. The bundle and its stylesheet.
const ext = ['react', 'react-dom', 'react-dom/client']
const glob = { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' }
await lib(resolve(HERE, 'entry.tsx'), 'OnTrack', resolve(TMP, 'bundle'), 'bundle.js', ext, glob, {
  plugins: [tailwindcss()],
})

const COMPONENTS = cards.map((c) => c.name).filter((n) => n !== 'Skeleton' && n !== 'Icons')
let js = ascii(readFileSync(resolve(TMP, 'bundle/bundle.js'), 'utf8'))
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '\\x3C!--')
const header = { format: 4, namespace: 'OnTrack', components: COMPONENTS.map((name) => ({ name })) }
writeFileSync(resolve(CMP, 'bundle.js'), `/* @ds-bundle: ${JSON.stringify(header)} */\n${js}`)

// The stylesheet without the fonts (tokens.json has them) and without every value tokens.json declares,
// so an edit on the page wins. What tokens.json cannot hold (safe areas, the hue wheel, the panel mixes) stays.
const { tokens, names, report } = makeTokens(resolve(APP, 'styles/tokens.css'))
let css = readFileSync(resolve(TMP, 'bundle/bundle.css'), 'utf8')
css = stripBlocks(css, /^@font-face\b/)
css = css.replace(/(^|\n)([ \t]*)(:root|\[data-theme="dark"\])\s*\{([^{}]*)\}/g, (all, nl, ind, sel, body) => {
  const kept = body.split(';').filter((d) => {
    const m = /^\s*--([a-z0-9-]+)\s*:/.exec(d)
    return d.trim() && !(m && names.has(m[1]))
  })
  return kept.length ? `${nl}${ind}${sel} {${kept.join(';')};\n${ind}}` : ''
})
css = css.replace(/@supports \(color: color-mix\(in lab, red, red\)\) \{\s*\}/g, '')
css = `/* OnTrack: the app's compiled Tailwind stylesheet (app/src/index.css), less the fonts and the tokens in tokens.json. */\n${css}`
if (/<\/style/i.test(css)) throw new Error('</style in css')
writeFileSync(resolve(CMP, 'bundle.css'), css)

// 5. tokens.json and the fonts.
writeFileSync(resolve(OUT, 'tokens.json'), JSON.stringify(tokens, null, 2) + '\n')
mkdirSync(resolve(OUT, 'fonts'), { recursive: true })
for (const f of tokens.type.fonts) {
  const pkg = basename(f.file).replace(/-latin-.*/, '')
  copyFileSync(
    resolve(HERE, '../../app/node_modules/@fontsource', pkg, 'files', basename(f.file)),
    resolve(OUT, f.file),
  )
}

// 6. Types: each card's file, and one index.d.ts with a <Card>Props per card.
const dts = (file) => readFileSync(resolve(TMP, 'dts/components', `${file}.d.ts`), 'utf8')
const strip = (t) =>
  t
    .replace(/^import .*$/gm, '')
    .replace(/^export \{\};?$/gm, '')
    .trim()
let index = `/* OnTrack components: window.OnTrack. Documentation, generated from app/src/components. */\n`
index += `/** What the app gives every screen (router, toasts, theme); wrap anything you render in it. */\nexport declare function Frame(props: { children: React.ReactNode; initialPath?: string }): JSX.Element;\n\n`
for (const file of [...new Set(Object.values(SOURCE))]) index += `/* ---- ${file}.tsx ---- */\n${strip(dts(file))}\n\n`
for (const c of cards) {
  const text = dts(SOURCE[c.name])
  const props = propsOf(text, c.name)
  if (props) index += `export type ${c.name}Props = ${props};\n`
  mkdirSync(resolve(CMP, c.name), { recursive: true })
  writeFileSync(
    resolve(CMP, c.name, `${c.name}.d.ts`),
    `/* app/src/components/${SOURCE[c.name]}.tsx */\n${strip(text)}\n`,
  )
}
writeFileSync(resolve(CMP, 'index.d.ts'), index)

// 7. Previews.
for (const c of cards) {
  const dir = resolve(TMP, 'pv', c.name)
  await build({
    ...base,
    oxc: { jsx: { runtime: 'classic', pragma: 'React.createElement', pragmaFrag: 'React.Fragment' } },
    plugins: [globalsShim(['react', 'react-dom/client', 'ontrack'])],
    build: {
      outDir: dir,
      emptyOutDir: true,
      minify: false,
      lib: {
        entry: resolve(TMP, 'previews', `${c.name}.tsx`),
        formats: ['iife'],
        name: 'Preview',
        fileName: () => 'p.js',
      },
    },
  })
  const code = ascii(readFileSync(resolve(dir, 'p.js'), 'utf8')).replace(/<\/script/gi, '<\\/script')
  writeFileSync(
    resolve(CMP, c.name, 'preview.html'),
    `<!-- @dsCard group="${c.group}" height=${c.height} -->\n<!doctype html>\n<html>\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>\n<body>\n<div id="root"></div>\n<script>\n${code}</script>\n</body>\n</html>\n`,
  )
}
// 8. The hand-written brand book, the Logos note and the cover.
cpSync(resolve(HERE, 'static'), OUT, { recursive: true })
writeFileSync(resolve(TMP, 'cards.json'), JSON.stringify(cards, null, 2))
console.log(`${cards.length} cards; bundle ${(js.length / 1024) | 0} KB; css ${(css.length / 1024) | 0} KB`)
console.log(report.filter((l) => +l.split(': ')[1] < 4.5).join('\n') || 'contrast ok')

function stripBlocks(text, start) {
  let out = ''
  let i = 0
  const re = new RegExp(start.source, 'gm')
  let m
  while ((m = re.exec(text))) {
    out += text.slice(i, m.index)
    let j = text.indexOf('{', m.index)
    let depth = 0
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}' && --depth === 0) break
    }
    i = j + 1
    re.lastIndex = i
  }
  return out + text.slice(i)
}

function propsOf(text, name) {
  const at = text.indexOf(`export declare function ${name}(`)
  if (at < 0) return null
  // Skip the destructuring pattern to the type after "}: " (or the single param's ": ").
  let j = text.indexOf('(', at) + 1
  let depth = 0
  if (text[j] === '{') {
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}' && --depth === 0) break
    }
    j++
  } else j = text.indexOf(':', j) - 0
  j = text.indexOf(':', j) + 1
  // Read the type to the closing paren at depth 0.
  let k = j
  depth = 0
  for (; k < text.length; k++) {
    const ch = text[k]
    if ('{(<['.includes(ch)) depth++
    else if ('})>]'.includes(ch) && !(ch === '>' && text[k - 1] === '=')) {
      if (depth === 0) break
      depth--
    }
  }
  return text.slice(j, k).trim() || null
}
