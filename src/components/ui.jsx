import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { appInfo } from '../api/ipc.js'
import { BRAND } from '../lib/brand.js'

// Turn a raw API error into a plain-language reason for end users.
function explainError(error) {
  const e = String(error || '').toLowerCase()
  if (e.includes('not found') || e.includes('404'))
    return 'The API endpoint was not found. The module may be enabled but its REST API is not available on this Dolibarr version.'
  if (e.includes('internal server') || e.includes('500'))
    return 'The server returned an internal error. Check the module configuration or that its REST API is enabled in Dolibarr.'
  if (e.includes('forbidden') || e.includes('denied') || e.includes('permission') || e.includes('401') || e.includes('403'))
    return 'Access was denied. The API user may not have permission for this module.'
  if (e.includes('timed out') || e.includes('reach') || e.includes('network'))
    return 'The server could not be reached. Check your internet connection and the API URL.'
  return 'The request failed. See the technical details below.'
}

// Rich error panel for module/API failures — clear reason, endpoint, and
// recovery actions (retry, back, copy details, report).
export function ApiErrorPanel({ title = 'Couldn’t load this module', endpoint, error, onRetry, onBack }) {
  const [copied, setCopied] = useState(false)
  const details = [`${title}`, endpoint ? `Endpoint: ${endpoint}` : '', `Error: ${error || 'unknown'}`, `App: ${BRAND.appName}`, `Time: ${new Date().toISOString()}`]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <div className="text-4xl">⚠️</div>
      <h2 className="mt-3 text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{explainError(error)}</p>
      {endpoint && (
        <div className="mt-3 inline-block rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {endpoint}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && <button className="btn-primary" onClick={onRetry}>↻ Retry</button>}
        {onBack && <button className="btn-outline" onClick={onBack}>← Back to Modules</button>}
        <button
          className="btn-outline"
          onClick={() => { navigator.clipboard?.writeText(details).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
        >
          {copied ? '✓ Copied' : '⧉ Copy error details'}
        </button>
        <button className="btn-outline" onClick={() => appInfo.openExternal(BRAND.issues)}>🐛 Report issue</button>
      </div>
      <details className="mx-auto mt-5 max-w-md text-left">
        <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">Technical details</summary>
        <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{details}</pre>
      </details>
    </div>
  )
}

// Renders Dolibarr HTML content (notes, descriptions) after sanitising it.
// Strips scripts/event-handlers/javascript: URLs so remote HTML is XSS-safe.
export function SafeHtml({ html, className = '' }) {
  const clean = DOMPurify.sanitize(html || '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['style'],
  })
  return (
    <div
      className={`prose-dolibarr text-sm leading-relaxed text-slate-700 dark:text-slate-300 ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

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

// Shimmering placeholder block.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />
}

// Skeleton table for list loading states — feels faster than a spinner.
export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0 dark:border-slate-800">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

// Grid of skeleton cards for dashboard-style loading.
export function CardsSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-6 w-28" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

// Standard page wrapper — consistent max-width + padding across screens.
export function Page({ children, wide = false }) {
  return <div className={`mx-auto w-full p-6 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>{children}</div>
}

// Standard page header: title, optional subtitle, and right-aligned actions.
export function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
          {icon && <span>{icon}</span>}
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
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
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onCancel?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])
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
