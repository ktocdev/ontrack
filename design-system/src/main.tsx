import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, RouterProvider } from 'react-router'
import { ToastProvider } from '@app/components/Toast'
import { ThemeProvider } from '@app/theme/ThemeProvider'
import { Layout } from './chrome/Layout'
import { PageHeader } from './chrome/Doc'
import { PAGES } from './pages/registry'
import { TokenProvider } from './tokens/store'
import './styles.css'

function NotFound() {
  return (
    <PageHeader eyebrow="Not found" title="No page here">
      <p>
        That link may point at an app route, which only the app has. <Link to="/">Back to the overview</Link>.
      </p>
    </PageHeader>
  )
}

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        ...PAGES.map((p) => ({ path: p.path, element: <p.Component /> })),
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  // BASE_URL is /ontrack/design-system/; the router wants it without the trailing slash.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TokenProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TokenProvider>
    </ThemeProvider>
  </StrictMode>,
)
