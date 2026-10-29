import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * Toast: a dark bar (text color on white text) 16px from the sides, sitting
 * just above the tab bar, 12px radius, 14px text. One at a time, 4 seconds,
 * announced through role="status".
 */
type ToastItem = { id: number; message: string; action?: { label: string; onClick: () => void } }

type Ctx = { show: (message: string, action?: ToastItem['action']) => void }

const ToastContext = createContext<Ctx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((message: string, action?: ToastItem['action']) => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), message, action })
    timer.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const value = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 z-50 flex justify-center"
        style={{ bottom: 'calc(84px + max(8px, var(--safe-bottom)))' }}
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-[480px] items-center gap-2.5 rounded-input bg-text px-3.5 py-3 text-14 text-bg shadow-raised animate-[fade-in_.15s_ease-out]"
          >
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="min-h-9 rounded-control px-2 font-bold text-toast-action hover:underline active:opacity-70"
                onClick={() => {
                  toast.action?.onClick()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
