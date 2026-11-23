import { createContext, Suspense, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { matchPath, Outlet, Route, Routes, useLocation, useNavigate, type Location } from 'react-router'
import { useLaptop } from '../lib/useWide'

/** A list SplitView can show: its route pattern and the screen. */
export type SplitList = { path: string; element: ReactNode }

/** The path open in the pane beside a list, so the list can mark its card. */
const OpenItem = createContext<string | null>(null)

/** Where closing the pane goes: the list, at the address it was left at. */
const PaneClose = createContext<string | null>(null)

/** Whether `to` is what the pane beside the list has open (OT-159), on any of its tabs. */
export function useOpenInPane(to: string | undefined) {
  return isOpenIn(useContext(OpenItem), to)
}

/**
 * The same question for many links at once: a function that answers it for each, for a
 * list that must keep the open item's card on screen (a closed restaurant on the dashboard).
 */
export function useIsOpenInPane() {
  const open = useContext(OpenItem)
  return (to: string | undefined) => isOpenIn(open, to)
}

const isOpenIn = (open: string | null, to: string | undefined) =>
  !!to && !!open && (open === to || open.startsWith(`${to}/`))

/**
 * Inside the pane beside a list, where its X goes (OT-164): the list as it was left, so
 * an item's back arrow becomes Close. Null anywhere else.
 */
export function usePaneClose() {
  return useContext(PaneClose)
}

/**
 * List and detail (OT-159; no board draws it). A layout route around a list's routes and
 * its item's route. Below 1024 px it is only its Outlet, so a phone shows the list or the
 * item as before.
 *
 * From 1024 px a list on its own sits in the reading column like any other screen (so
 * Open tickets and In-house line up, OT-164). Opening an item moves the list into a pane on
 * the left and the item opens beside it, with an X to close it again. The address is the
 * item's own route, so a lasting link, Back and a reload all work.
 *
 * The list is the last list route visited, rendered at the address it was visited with
 * (its tab, month or restaurant), and stays mounted while items open and close, so it
 * keeps its scroll; opened straight from a link, it is `fallback`, or none, and the item
 * has the width to itself.
 *
 * For the keyboard (OT-162): opening an item moves focus into the panel, Escape closes it
 * when no sheet or menu is open and nothing is being typed, and closing it puts focus back
 * on the item's card in the list.
 */
export function SplitView({
  lists,
  fallback,
}: {
  lists: SplitList[]
  /** The list to show beside an item opened straight from a link; without one, the item alone. */
  fallback?: string
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

  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const lastOpen = useRef<string | null>(null)
  const list = laptop && listAt ? lists.find((l) => matchPath(l.path, listAt.pathname)) : undefined
  const open = !!list && !atList
  const closeTo = listAt ? listAt.pathname + listAt.search : null

  // Focus into the panel as an item opens; back to its card as the panel closes.
  useEffect(() => {
    if (open) {
      if (lastOpen.current !== location.pathname) paneRef.current?.focus({ preventScroll: true })
      lastOpen.current = location.pathname
      return
    }
    const was = lastOpen.current
    lastOpen.current = null
    if (!was || !listRef.current) return
    const card = [...listRef.current.querySelectorAll<HTMLAnchorElement>('a[href]')].find((a) => {
      const href = a.getAttribute('href')!
      return was === href || was.startsWith(`${href}/`)
    })
    card?.focus({ preventScroll: true })
  }, [open, location.pathname])

  // Escape closes the panel, unless a sheet, menu or picker has it, or someone is typing.
  useEffect(() => {
    if (!open || !closeTo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return
      const el = document.activeElement
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      navigate(closeTo)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closeTo, navigate])

  if (!list) return <Outlet />

  return (
    <div className="flex min-h-0 flex-1">
      {/* The same element open or not, so the list is never remounted. */}
      <div
        ref={listRef}
        data-split-list={open ? 'beside' : 'alone'}
        className={`flex min-h-0 flex-col ${open ? 'w-list-pane flex-none border-r border-border' : 'min-w-0 flex-1'}`}
      >
        <OpenItem.Provider value={open ? location.pathname : null}>
          <Suspense fallback={null}>
            <Routes location={listAt!}>
              <Route path={list.path} element={list.element} />
            </Routes>
          </Suspense>
        </OpenItem.Provider>
      </div>
      {open && (
        <div
          ref={paneRef}
          tabIndex={-1}
          role="region"
          aria-label="Details"
          data-split-pane
          className="flex min-w-0 flex-1 flex-col animate-[fade-in_.15s_ease-out] outline-none motion-reduce:animate-none"
        >
          <PaneClose.Provider value={closeTo}>
            <Outlet />
          </PaneClose.Provider>
        </div>
      )}
    </div>
  )
}
