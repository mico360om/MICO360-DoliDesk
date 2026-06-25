// Small shared presentational pieces used across pages.

const TONES = {
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  red: 'bg-rose-100 text-rose-700 ring-rose-600/20',
  blue: 'bg-brand-100 text-brand-700 ring-brand-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

export function StatusBadge({ label, tone = 'slate' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        TONES[tone] || TONES.slate
      }`}
    >
      {label}
    </span>
  )
}

export function Spinner({ className = '' }) {
  return (
    <svg className={`h-5 w-5 animate-spin text-brand-600 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
      <Spinner className="h-7 w-7" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="text-base font-semibold text-slate-700">{title}</div>
      {subtitle && <div className="max-w-sm text-sm text-slate-500">{subtitle}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// A labelled row used throughout the settings pages.
export function Row({ title, subtitle, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        {message && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  const tone = toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'
  return (
    <div className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg ${tone} px-4 py-2.5 text-sm text-white shadow-lg`}>
      {toast.message}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-4xl">⚠️</div>
      <div className="text-base font-semibold text-slate-700">{title}</div>
      {message && <div className="max-w-md text-sm text-rose-600">{message}</div>}
      {onRetry && (
        <button className="btn-outline mt-2" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
