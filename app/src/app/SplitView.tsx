import { createContext, Suspense, useContext, useState, type ReactNode } from 'react'
import { matchPath, Outlet, Route, Routes, useLocation, type Location } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { IconList } from '../components/icons'
import { useLaptop } from '../lib/useWide'

/** A list SplitView can show: its route pattern and the screen. */
export type SplitList = { path: string; element: ReactNode }

/** The path open in the pane beside a list, so the list can mark its card. */
const OpenItem = createContext<string | null>(null)

/** Whether `to` is what the pane beside the list has open (OT-159). */
export function useOpenInPane(to: string | undefined) {
  const open = useContext(OpenItem)
  return !!to && open === to
}

/**
 * List and detail (OT-159; no board draws it). A layout route around a list's routes and
 * its item's route. Below 1024 px it is only its Outlet, so a phone shows the list or the
 * item as before. From 1024 px the list stays on the left and the item opens beside it;
 * the address is the item's own route, so a lasting link, Back and a reload all work.
 *
 * The list on the left is the last list route visited, rendered at the address it was
 * visited with (its tab, month or restaurant), so it keeps its place while items open
 * beside it; opened straight from a link, it is `fallback`, or none, and the item has the
 * width to itself. With no item open the pane says what to pick.
 */
export function SplitView({
  lists,
  fallback,
  empty,
}: {
  lists: SplitList[]
  /** The list to show beside an item opened straight from a link; without one, the item alone. */
  fallback?: string
  empty: { title: string; body: string }
}) {
  const laptop = useLaptop()
  const location = useLocation()
  const atList = lists.find((l) => matchPath(l.path, location.pathname))
  const [listAt, setListAt] = useState<Location | null>(() =>
    atList ? location : fallback ? { ...location, pathname: fallback, search: '', hash: '', state: null } : null,
  )
  // Remember the list the person was on, with its search, as they move around it.
  if (atList && (listAt?.pathname !== location.pathname || listAt.search !== location.search)) {
    setListAt(location)
  }

  if (!laptop) return <Outlet />
  const list = listAt && lists.find((l) => matchPath(l.path, listAt.pathname))
  if (!list) return <Outlet />

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-list-pane flex-none flex-col border-r border-border">
        <OpenItem.Provider value={atList ? null : location.pathname}>
          <Suspense fallback={null}>
            <Routes location={listAt!}>
              <Route path={list.path} element={list.element} />
            </Routes>
          </Suspense>
        </OpenItem.Provider>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {atList ? (
          <div className="flex flex-1 items-center justify-center px-screen" data-testid="split-empty">
            <EmptyState icon={<IconList />} title={empty.title} body={empty.body} />
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  )
}
