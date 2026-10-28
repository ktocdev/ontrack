import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './components/Toast'
import { useAppUpdate } from './pwa/useAppUpdate'
import { ThemeProvider } from './theme/ThemeProvider'

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
        },
      }),
  )
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <UpdatePrompt />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

/** A new build is waiting: offer it without reloading under anyone. */
function UpdatePrompt() {
  const update = useAppUpdate()
  if (!update.needRefresh) return null
  return (
    <div
      role="status"
      className="fixed inset-x-4 z-50 mx-auto flex max-w-[480px] items-center justify-between gap-3 rounded-input bg-brand-strong px-4 py-3 text-on-brand shadow-[0_8px_24px_-8px_rgba(21,32,27,.4)]"
      style={{ bottom: 'calc(104px + var(--safe-bottom))' }}
    >
      <span className="text-14 font-semibold">A new version is ready.</span>
      <button type="button" className="min-h-tap rounded-control px-3 font-bold" onClick={update.applyUpdate}>
        Update
      </button>
    </div>
  )
}
