import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './components/Toast'
import { UpdateBar } from './components/UpdateBar'
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
  return <UpdateBar updating={update.updating} onUpdate={update.applyUpdate} />
}
