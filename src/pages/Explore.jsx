import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/ipc.js'
import { ApiErrorPanel, EmptyState, Loading, SafeHtml } from '../components/ui.jsx'
import { getModuleMeta } from '../lib/moduleMeta.js'
import { formatDate, formatMoney, humanizeKey, extraFields } from '../lib/format.js'

// Generic browser for any Dolibarr module endpoint (used for custom modules
// that aren't in the curated entity registry). Columns and fields are
// inferred from the data — formatted, never raw JSON.

const PREFERRED = ['ref', 'label', 'name', 'title', 'code', 'code_client', 'date', 'total_ttc', 'price', 'status', 'statut']
const SKIP = new Set(['entity', 'import_key', 'array_options', 'array_languages', 'lines', 'linkedObjects', 'linkedObjectsIds', 'canvas', 'fields', 'context'])
const HTML_FIELDS = new Set(['note_public', 'note_private', 'note', 'description'])
const isHtml = (v) => typeof v === 'string' && /<[a-z][\s\S]*>/i.test(v)
const recId = (r) => r.id ?? r.rowid ?? r.ref

function fmt(key, v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return ''
  if (/(^|_)date/i.test(key) && /^\d+$/.test(String(v))) return formatDate(v)
  if (/(total|price|amount|montant|_ttc|_ht)/i.test(key)) return formatMoney(v)
  return String(v)
}

function inferColumns(rows) {
  const keys = new Set()
  for (const r of rows.slice(0, 15)) {
    for (const [k, v] of Object.entries(r)) {
      if (v !== null && v !== undefined && typeof v !== 'object' && !SKIP.has(k)) keys.add(k)
    }
  }
  const present = [...keys]
  const picked = PREFERRED.filter((k) => keys.has(k))
  for (const k of present) {
    if (picked.length >= 6) break
    if (!picked.includes(k)) picked.push(k)
  }
  return picked.slice(0, 6)
}

export function ExploreList() {
  const { module } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const pageSize = 50

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await api.listRaw(module, { limit: pageSize, page }))
    } catch (e) {
      setError(e.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [module, page])

  useEffect(() => setPage(0), [module])
  useEffect(() => { load() }, [load])

  const columns = useMemo(() => inferColumns(rows), [rows])
  const meta = getModuleMeta(module)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 pb-4 pt-5 dark:border-slate-800 dark:bg-slate-900">
        <button className="btn-ghost mb-2 -ml-2" onClick={() => navigate('/modules')}>← Modules</button>
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
            <span>{meta.icon}</span> {meta.label}
            <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{rows.length}</span>
          </h1>
          <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {loading ? (
          <Loading label={`Loading ${meta.label}…`} />
        ) : error ? (
          <ApiErrorPanel title={`Couldn’t load ${meta.label}`} endpoint={`/${module}`} error={error} onRetry={load} onBack={() => navigate('/modules')} />
        ) : rows.length === 0 ? (
          <EmptyState icon={meta.icon} title="No records yet" subtitle={`There are no ${meta.label.toLowerCase()} to show, or this module has no data on this page.`} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  {columns.map((c) => (
                    <th key={c} className="px-4 py-3 font-semibold">{humanizeKey(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={recId(r)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-brand-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    onClick={() => navigate(`/explore/${module}/${recId(r)}`)}
                  >
                    {columns.map((c, i) => (
                      <td key={c} className={`px-4 py-3 ${i === 0 ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                        {fmt(c, r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span>Page {page + 1}</span>
          <div className="flex gap-2">
            <button className="btn-outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Previous</button>
            <button className="btn-outline" disabled={rows.length < pageSize} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ExploreDetail() {
  const { module, id } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getRaw(module, id)
      .then((d) => !cancelled && setRecord(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [module, id])

  const fields = useMemo(() => {
    if (!record) return []
    return Object.entries(record).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && v !== '' && typeof v !== 'object')
  }, [record])

  const meta = getModuleMeta(module)

  return (
    <div className="mx-auto max-w-4xl p-6">
      <button className="btn-ghost mb-4 -ml-2" onClick={() => navigate(`/explore/${module}`)}>← Back to {meta.label}</button>
      {loading ? (
        <Loading label="Loading record…" />
      ) : error ? (
        <ApiErrorPanel title={`Couldn’t load this ${meta.label.toLowerCase()} record`} endpoint={`/${module}/${id}`} error={error} onRetry={() => navigate(0)} onBack={() => navigate(`/explore/${module}`)} />
      ) : !record ? (
        <ApiErrorPanel title="Record not found" endpoint={`/${module}/${id}`} error="Not found" onBack={() => navigate(`/explore/${module}`)} />
      ) : (
        <>
          <div className="card mb-5 p-6">
            <div className="text-sm text-slate-400">{meta.icon} {meta.label} · #{recId(record)}</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
              {record.ref || record.label || record.name || record.title || `#${recId(record)}`}
            </h1>
          </div>
          <div className="card mb-5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Fields</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {fields.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{humanizeKey(k)}</dt>
                  <dd className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">
                    {HTML_FIELDS.has(k) && isHtml(v) ? <SafeHtml html={v} /> : fmt(k, v)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Custom fields (extrafields) */}
          {extraFields(record).length > 0 && (
            <div className="card mb-5 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Custom fields</h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {extraFields(record).map((f) => (
                  <div key={f.key} className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{f.label}</dt>
                    <dd className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">{String(f.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Line items, if the record has them */}
          {Array.isArray(record.lines) && record.lines.length > 0 && (
            <div className="card mb-5 overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                Line items <span className="text-slate-400">({record.lines.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                      {inferColumns(record.lines).map((c) => <th key={c} className="px-4 py-2.5 font-semibold">{humanizeKey(c)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {record.lines.map((l, i) => (
                      <tr key={l.id ?? l.rowid ?? i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        {inferColumns(record.lines).map((c) => (
                          <td key={c} className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{fmt(c, l[c])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
