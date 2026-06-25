import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/ipc.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import { ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui.jsx'
import { HBars } from '../components/charts.jsx'
import { formatDate, formatMoney, humanizeKey, toNumber } from '../lib/format.js'

// Client Account Statement (MICO360 Client Statement module → /mico360statements).
// The exact JSON shape varies, so this renders adaptively: headline totals,
// ageing buckets, and any line tables — all formatted, never raw JSON.

const isMoneyKey = (k) => /(total|amount|balance|due|paid|outstanding|ttc|_ht|credit|debit)/i.test(k)
const isDateKey = (k) => /(^|_)date|_dt$/i.test(k)

function fmt(k, v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return ''
  if (isDateKey(k) && /^\d+$/.test(String(v))) return formatDate(v)
  if (isMoneyKey(k)) return formatMoney(v)
  return String(v)
}

function inferColumns(rows) {
  const keys = new Set()
  for (const r of rows.slice(0, 15)) for (const [k, v] of Object.entries(r)) if (v != null && typeof v !== 'object') keys.add(k)
  const pref = ['ref', 'date', 'type', 'label', 'description', 'total_ttc', 'amount', 'debit', 'credit', 'balance', 'status']
  const all = [...keys]
  const picked = pref.filter((k) => keys.has(k))
  for (const k of all) { if (picked.length >= 7) break; if (!picked.includes(k)) picked.push(k) }
  return picked.slice(0, 7)
}

export default function Statements() {
  const { activeId } = useProfiles()
  const [customers, setCustomers] = useState([])
  const [socid, setSocid] = useState('0')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [type, setType] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ran, setRan] = useState(false)

  // Load customers for the picker.
  useEffect(() => {
    let cancelled = false
    api
      .list('thirdparties', { limit: 500, page: 0, sortfield: 't.rowid', sortorder: 'ASC' })
      .then((rows) => !cancelled && setCustomers(rows.map((r) => ({ id: String(r.id ?? r.rowid), name: r.name || r.name_alias || `#${r.id ?? r.rowid}` }))))
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeId])

  async function run() {
    setLoading(true)
    setError(null)
    setRan(true)
    try {
      const params = { type, with_ageing: 1, with_payments: 1, with_creditnotes: 1 }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      setData(await api.statement(socid, params))
    } catch (e) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const { totals, scalars, ageing, tables } = useMemo(() => parseStatement(data), [data])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader icon="📑" title="Client Statements" subtitle="MICO360 Client Account Statement" />

      {/* Controls */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <Field label="Customer">
          <select className="input w-56" value={socid} onChange={(e) => setSocid(e.target.value)}>
            <option value="0">All customers (consolidated)</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="From"><input type="date" className="input w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" className="input w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
        <Field label="Type">
          <select className="input w-40" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All</option>
            <option value="outstanding">Outstanding</option>
            <option value="paid">Paid</option>
          </select>
        </Field>
        <button className="btn-primary" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Generate'}</button>
      </div>

      {loading ? (
        <Loading label="Building statement…" />
      ) : error ? (
        <ErrorState message={error} onRetry={run} />
      ) : !ran ? (
        <div className="card px-5 py-10 text-center text-sm text-slate-400">Choose a customer and period, then Generate.</div>
      ) : !data ? (
        <div className="card px-5 py-10 text-center text-sm text-slate-400">No statement data for this selection.</div>
      ) : (
        <>
          {totals.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {totals.map((t) => (
                <div key={t.label} className="card p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{humanizeKey(t.label)}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatMoney(t.value)}</div>
                </div>
              ))}
            </div>
          )}

          {ageing.length > 0 && (
            <div className="card p-5">
              <div className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Ageing</div>
              <HBars items={ageing.map((a) => ({ label: a.label, value: a.value, display: formatMoney(a.value) }))} tone="amber" />
            </div>
          )}

          {scalars.length > 0 && (
            <div className="card p-5">
              <div className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Summary</div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {scalars.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{humanizeKey(k)}</dt>
                    <dd className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">{fmt(k, v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {tables.map((tbl) => (
            <div key={tbl.key} className="card overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                {humanizeKey(tbl.key)} <span className="text-slate-400">({tbl.rows.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                      {tbl.cols.map((c) => <th key={c} className="px-4 py-2.5 font-semibold">{humanizeKey(c)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {tbl.rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        {tbl.cols.map((c) => (
                          <td key={c} className={`px-4 py-2.5 ${isMoneyKey(c) ? 'text-right tabular-nums' : ''} text-slate-700 dark:text-slate-300`}>
                            {c === 'status' || c === 'statut' ? <StatusBadge label={String(r[c])} tone="slate" /> : fmt(c, r[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

// Pull headline totals, ageing buckets, scalar summary fields and line tables
// out of whatever shape the statement endpoint returns.
function parseStatement(data) {
  if (!data || typeof data !== 'object') return { totals: [], scalars: [], ageing: [], tables: [] }

  const totals = []
  const scalars = []
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'object' || v === null || v === '') continue
    if (isMoneyKey(k) && toNumber(v) !== null) totals.push({ label: k, value: toNumber(v) })
    else scalars.push([k, v])
  }

  // Ageing can be an object {b0_30: x,...} or an array of {label,amount}.
  const ageRaw = data.ageing || data.aging
  const ageing = []
  if (Array.isArray(ageRaw)) {
    for (const a of ageRaw) ageing.push({ label: a.label || a.range || a.bucket || '—', value: toNumber(a.amount ?? a.value ?? a.total) || 0 })
  } else if (ageRaw && typeof ageRaw === 'object') {
    for (const [k, v] of Object.entries(ageRaw)) ageing.push({ label: humanizeKey(k), value: toNumber(v) || 0 })
  }

  // Render any array-of-objects property (invoices, payments, lines…) as a table.
  const tables = []
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      tables.push({ key: k, rows: v, cols: inferColumns(v) })
    }
  }

  return { totals: totals.slice(0, 8), scalars: scalars.slice(0, 12), ageing, tables }
}
