import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

let nextId = 1

// Global, actionable toast system. `toast(message, { type, action })` shows a
// transient message; an optional action renders a button (e.g. Retry/Undo).
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const toast = useCallback(
    (message, opts = {}) => {
      const id = nextId++
      const ttl = opts.duration ?? (opts.action ? 8000 : 5000)
      setToasts((t) => [...t, { id, message, type: opts.type || 'info', action: opts.action }])
      timers.current[id] = setTimeout(() => dismiss(id), ttl)
      return id
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${
              t.type === 'error' ? 'bg-rose-600' : t.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'
            }`}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                className="rounded bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30"
                onClick={() => {
                  t.action.onClick?.()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="text-white/70 hover:text-white" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
