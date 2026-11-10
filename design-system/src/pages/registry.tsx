import type { ComponentType } from 'react'
import { Overview } from './Overview'
import { ColorPage, ElevationPage, IconsPage, ShapePage, SpacingPage, TypographyPage } from './foundations'
import { AvatarsPage, ButtonsPage, CardsPage, PillsPage, RestaurantsPage } from './components-basics'
import { ChoicesPage, FeedbackPage, FieldsPage, NavigationPage, SheetsPage } from './components-forms'
import { EquipmentPage, LoadingPage, ThreadPage, TicketsPage } from './components-work'

/** Every docs page, in sidebar order. The router and the sidebar both read this. */
export type PageDef = { path: string; title: string; summary: string; Component: ComponentType }

export const NAV: { title: string; pages: PageDef[] }[] = [
  {
    title: 'Start',
    pages: [{ path: '/', title: 'Overview', summary: 'How the system fits together', Component: Overview }],
  },
  {
    title: 'Foundations',
    pages: [
      {
        path: '/foundations/color',
        title: 'Color',
        summary: 'Every color token, both themes, the ramps',
        Component: ColorPage,
      },
      {
        path: '/foundations/typography',
        title: 'Typography',
        summary: 'Families, roles and the scale',
        Component: TypographyPage,
      },
      { path: '/foundations/shape', title: 'Shape', summary: 'Corner radii', Component: ShapePage },
      {
        path: '/foundations/elevation',
        title: 'Elevation',
        summary: 'Shadows and the scrim',
        Component: ElevationPage,
      },
      {
        path: '/foundations/spacing',
        title: 'Spacing and layout',
        summary: 'Phone rules and layout tokens',
        Component: SpacingPage,
      },
      { path: '/foundations/icons', title: 'Icons', summary: 'The full set', Component: IconsPage },
    ],
  },
  {
    title: 'Components',
    pages: [
      {
        path: '/components/buttons',
        title: 'Buttons',
        summary: 'Variants, states, icon buttons',
        Component: ButtonsPage,
      },
      { path: '/components/status', title: 'Status and tags', summary: 'Pills, tags, badges', Component: PillsPage },
      {
        path: '/components/restaurants',
        title: 'Restaurants',
        summary: 'Name, square, pickers',
        Component: RestaurantsPage,
      },
      { path: '/components/avatars', title: 'Avatars', summary: 'Roles, states, sizes', Component: AvatarsPage },
      { path: '/components/cards', title: 'Cards and rows', summary: 'Lists, details, tiles', Component: CardsPage },
      { path: '/components/fields', title: 'Fields', summary: 'Text, search, passwords, codes', Component: FieldsPage },
      {
        path: '/components/choices',
        title: 'Choices and toggles',
        summary: 'Segmented, chips, radio cards, switch',
        Component: ChoicesPage,
      },
      {
        path: '/components/navigation',
        title: 'Navigation',
        summary: 'Headers, bars, tabs',
        Component: NavigationPage,
      },
      {
        path: '/components/feedback',
        title: 'Feedback',
        summary: 'Notices, toasts, empty states',
        Component: FeedbackPage,
      },
      {
        path: '/components/sheets',
        title: 'Sheets and menus',
        summary: 'Sheets, menus, the status menu',
        Component: SheetsPage,
      },
      {
        path: '/components/tickets',
        title: 'Tickets',
        summary: 'Manager and Ops cards, closed rows',
        Component: TicketsPage,
      },
      {
        path: '/components/thread',
        title: 'Thread and photos',
        summary: 'Messages, composer, photos',
        Component: ThreadPage,
      },
      {
        path: '/components/equipment',
        title: 'Equipment and tasks',
        summary: 'Equipment lists, in-house tasks',
        Component: EquipmentPage,
      },
      { path: '/components/loading', title: 'Loading', summary: 'Spinners and skeletons', Component: LoadingPage },
    ],
  },
]

export const PAGES = NAV.flatMap((g) => g.pages)
