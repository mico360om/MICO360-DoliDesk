import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, exportFile } from '../api/ipc.js'
import { getEntity, recordId, buildSqlSearch } from '../lib/entities.js'
import { useColumnConfig } from '../lib/useColumnConfig.js'
import { toCSV } from '../lib/csv.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import { EmptyState, ErrorState, Loading, Spinner, StatusBadge } from '../components/ui.jsx'

const PAGE_SIZES = [25, 50, 100, 200]
const EXPORT_CAP = 5000

const ACCENT = {
  brand: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  slate: 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
}

export default function RecordList() {
  const { type } = useParams()
  const entity = getEntity(type)
  const navigate = useNavigate()
  const { activeId } = useProfiles()

  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(100)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [exporting, setExporting] = useState(false)
  const [menu, setMenu] = useState(null) // 'export' | 'columns' | null
  const [toast, setToast] = useState(null)
  const menuRef = useRef(null)

  const sqlfilters = useMemo(() => buildSqlSearch(entity, debounced), [entity, debounced])

  const customerName = useCallback(
    (r, map = names) => {
      if (!entity?.socField) return ''
      const id = r[entity.socField]
      if (!id) return '—'
      return map[String(id)] || `#${id}`
    },
    [entity, names]
  )

  // The full column set: entity columns (+ injected Customer) + a Status column.
  const allColumns = useMemo(() => {
    if (!entity) return []
    const base = entity.socField
      ? [entity.columns[0], { key: 'customer', label: 'Customer', grow: true }, ...entity.columns.slice(1)]
      : entity.columns
    return [...base, { key: 'status', label: 'Status', align: 'right', isStatus: true }]
  }, [entity])

  const { orderedColumns, visibleColumns, toggle, move, reset, isHidden, isCustomized } = useColumnConfig(
    entity?.key || 'none',
    allColumns
  )

  // Resolve a cell to a plain string (used by sort, CSV, and non-status cells).
  const cellValue = useCallback(
    (col, r, map) => {
      if (col.isStatus) return entity.status(r).label
      if (col.key === 'customer') return customerName(r, map)
      return col.render(r)
    },
    [entity, customerName]
  )

  const load = useCallback(async () => {
    if (!entity) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.list(entity.key, {
        limit: pageSize,
        page,
        sortfield: entity.sortfield,
        sortorder: 'DESC',
        sqlfilters,
      })
      setRows(data)
      if (entity.socField && data.length) {
        const ids = [...new Set(data.map((r) => String(r[entity.socField])).filter((x) => x && x !== '0'))]
        if (ids.length) {
          try {
            const map = await api.resolveThirdparties(ids)
            setNames((prev) => ({ ...prev, ...map }))
          } catch {
            /* best-effort */
          }
        }
      }
    } catch (e) {
      setError(e.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [entity, page, pageSize, sqlfilters])

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 400)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debounced, type, activeId])

  useEffect(() => {
    setSearch('')
    setDebounced('')
    setStatusFilter('all')
    setSort({ key: null, dir: 'asc' })
    setNames({})
  }, [type])

  useEffect(() => {
    load()
  }, [load, activeId])

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const statusOptions = useMemo(() => {
    if (!entity) return []
    const seen = new Map()
    for (const r of rows) {
      const s = entity.status(r)
      if (!seen.has(s.label)) seen.set(s.label, s.tone)
    }
    return [...seen.entries()].map(([label, tone]) => ({ label, tone }))
  }, [rows, entity])

  const view = useMemo(() => {
    if (!entity) return []
    let out = rows
    if (statusFilter !== 'all') out = out.filter((r) => entity.status(r).label === statusFilter)
    if (sort.key) {
      const col = allColumns.find((c) => c.key === sort.key)
      out = [...out].sort((a, b) => {
        const av = col ? String(cellValue(col, a) ?? '') : ''
        const bv = col ? String(cellValue(col, b) ?? '') : ''
        const cmp = av.localeCompare(bv, undefined, { numeric: true })
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, entity, statusFilter, sort, allColumns, names])

  const summary = useMemo(() => (entity?.summary ? entity.summary(view) : null), [entity, view])

  if (!entity) {
    return <div className="p-6"><ErrorState title="Unknown record type" message={type} /></div>
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  function buildCsv(records, map) {
    const headers = ['ID', ...visibleColumns.map((c) => c.label)]
    const csvRows = records.map((r) => [recordId(r), ...visibleColumns.map((c) => cellValue(c, r, map))])
    return toCSV(headers, csvRows)
  }

  async function doExport(scope) {
    setMenu(null)
    setExporting(true)
    try {
      let records
      let map = names
      if (scope === 'all') {
        const { rows: all, complete } = await api.listAll(entity.key, {
          sortfield: entity.sortfield,
          sortorder: 'DESC',
          sqlfilters,
          cap: EXPORT_CAP,
        })
        records = all
        if (entity.socField && all.length) {
          const ids = [...new Set(all.map((r) => String(r[entity.socField])).filter((x) => x && x !== '0'))]
          map = await api.resolveThirdparties(ids)
        }
        if (!complete) setToast(`Exported the first ${EXPORT_CAP} records (dataset is larger).`)
      } else {
        records = view
      }
      const content = buildCsv(records, map)
      const stamp = new Date().toISOString().slice(0, 10)
      const res = await exportFile({ defaultName: `${entity.key}-${scope}-${stamp}.csv`, content })
      if (res.saved) setToast(`Saved ${records.length} record${records.length === 1 ? '' : 's'} to ${res.path}`)
    } catch (e) {
      setToast('Export failed: ' + e.message)
    } finally {
      setExporting(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  const visibleCount = visibleColumns.length

  return (
    <div className="flex h-full flex-col">
      {/* Header + toolbar */}
      <div className="border-b border-slate-200 bg-white px-6 pb-4 pt-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
            <span>{entity.icon}</span> {entity.label}
            <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {view.length}
              {view.length !== rows.length ? ` / ${rows.length}` : ''}
            </span>
          </h1>
          <div className="flex items-center gap-2" ref={menuRef}>
            {/* Column chooser */}
            <div className="relative">
              <button className="btn-outline" onClick={() => setMenu((m) => (m === 'columns' ? null : 'columns'))}>
                ⚙ Columns{isCustomized ? ' •' : ''}
              </button>
              {menu === 'columns' && (
                <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <span>Columns</span>
                    <button className="font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={reset}>Reset</button>
                  </div>
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {orderedColumns.map((c, i) => {
                      const hidden = isHidden(c.key)
                      const lastVisible = !hidden && visibleCount === 1
                      return (
                        <li key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand-600"
                            checked={!hidden}
                            disabled={lastVisible}
                            onChange={() => toggle(c.key)}
                          />
                          <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{c.label}</span>
                          <button
                            className="rounded px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                            disabled={i === 0}
                            onClick={() => move(c.key, 'up')}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            className="rounded px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                            disabled={i === orderedColumns.length - 1}
                            onClick={() => move(c.key, 'down')}
                            title="Move down"
                          >
                            ↓
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Export menu */}
            <div className="relative">
              <button className="btn-outline" onClick={() => setMenu((m) => (m === 'export' ? null : 'export'))} disabled={exporting || rows.length === 0}>
                {exporting ? <Spinner className="h-4 w-4" /> : '⬇'} Export CSV
              </button>
              {menu === 'export' && (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <button className="block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => doExport('page')}>
                    Export current view ({view.length})
                  </button>
                  <button className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800" onClick={() => doExport('all')}>
                    Export all matching records
                  </button>
                </div>
              )}
            </div>

            <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              className="input pl-9"
              placeholder={`Search all ${entity.label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && loading && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />}
          </div>

          {statusOptions.length > 1 && (
            <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s.label} value={s.label}>{s.label}</option>
              ))}
            </select>
          )}

          <select className="input w-auto" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}>
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {/* Summary bar */}
        {summary && !loading && !error && rows.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.map((m) => (
              <div key={m.label} className={`rounded-xl border px-4 py-3 ${ACCENT[m.accent] || ACCENT.slate}`}>
                <div className="text-xs font-medium uppercase tracking-wide opacity-70">{m.label}</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">{m.value}</div>
                {m.sub && <div className="text-xs opacity-70">{m.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <Loading label={`Loading ${entity.label.toLowerCase()}…`} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={entity.icon}
            title={debounced ? 'No matches' : `No ${entity.label.toLowerCase()} found`}
            subtitle={
              debounced
                ? 'No records match your search across the dataset.'
                : 'There are no records here, or this module may be disabled in Dolibarr.'
            }
          />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  {visibleColumns.map((c) => (
                    <th
                      key={c.key}
                      className={`cursor-pointer select-none px-4 py-3 font-semibold hover:text-slate-700 dark:hover:text-slate-200 ${c.align === 'right' ? 'text-right' : ''}`}
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                      {sort.key === c.key && (sort.dir === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.map((r) => {
                  const id = recordId(r)
                  return (
                    <tr
                      key={id}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-brand-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                      onClick={() => navigate(`/records/${entity.key}/${id}`)}
                    >
                      {visibleColumns.map((c) => {
                        if (c.isStatus) {
                          const s = entity.status(r)
                          return (
                            <td key={c.key} className="px-4 py-3 text-right">
                              <StatusBadge label={s.label} tone={s.tone} />
                            </td>
                          )
                        }
                        return (
                          <td
                            key={c.key}
                            className={`px-4 py-3 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${
                              c.grow ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {cellValue(c, r)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {view.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-sm text-slate-400">
                      No records match the status filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span>Page {page + 1} · showing {rows.length} record{rows.length === 1 ? '' : 's'}</span>
          <div className="flex gap-2">
            <button className="btn-outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Previous</button>
            <button className="btn-outline" disabled={rows.length < pageSize} onClick={() => setPage((p) => p + 1)} title={rows.length < pageSize ? 'No more pages' : ''}>Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}
