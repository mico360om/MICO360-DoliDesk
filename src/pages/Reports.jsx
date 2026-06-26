import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, exportFile } from '../api/ipc.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { ENTITIES } from '../lib/entities.js'
import { toCSV } from '../lib/csv.js'
import { formatMoney, getBaseCurrency, toNumber, toDate } from '../lib/format.js'
import { BarChart } from '../components/charts.jsx'
import { ErrorState, PageHeader, Skeleton } from '../components/ui.jsx'

const CAP = 3000

const REPORTS = [
  { key: 'period', label: 'Sales by Period', icon: '📅' },
  { key: 'customer', label: 'Sales by Customer', icon: '🏢' },
  { key: 'aging', label: 'Aged Receivables', icon: '⏳' },
  { key: 'outstanding', label: 'Outstanding by Customer', icon: '💰' },
]

const PERIODS = [['all', 'All time'], ['year', 'This year'], ['quarter', 'This quarter'], ['month', 'This month']]

const isUnpaid = (r) => {
  const s = Number(r.status ?? r.statut)
  return Number(r.paye) !== 1 && s !== 0 && s !== 3
}
const periodStart = (p) => {
  if (p === 'all') return null
  const n = new Date()
  if (p === 'month') return new Date(n.getFullYear(), n.getMonth(), 1)
  if (p === 'quarter') return new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1)
  return new Date(n.getFullYear(), 0, 1)
}

export default function Reports() {
  const { activeId, company } = useProfiles()
  const { toast } = useToast()
  const cur = company?.currency_code || company?.currency || getBaseCurrency()
  const [params, setParams] = useSearchParams()
  const report = params.get('r') || 'period'
  const [period, setPeriod] = useState('all')

  const [invoices, setInvoices] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { rows } = await api.listAll('invoices', { cap: CAP, sortfield: 't.rowid', sortorder: 'DESC' })
      setInvoices(rows)
      const ids = [...new Set(rows.map((r) => String(r.socid ?? r.fk_soc ?? '')).filter((x) => x && x !== '0'))]
      if (ids.length) setNames(await api.resolveThirdparties(ids))
    } catch (e) {
      setError(e.message)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, activeId])

  const nameOf = (r) => names[String(r.socid ?? r.fk_soc ?? '')] || `Customer #${r.socid ?? r.fk_soc ?? '?'}`

  // Period-filtered set for the sales reports.
  const inPeriod = useMemo(() => {
    const start = periodStart(period)
    if (!start) return invoices
    return invoices.filter((r) => { const d = toDate(r.date); return d && d.getTime() >= start.getTime() })
  }, [invoices, period])

  const table = useMemo(() => buildReport(report, { invoices, inPeriod, nameOf, cur }), [report, invoices, inPeriod, names, cur])

  async function exportCsv() {
    const headers = table.columns.map((c) => c.label)
    const rows = table.rows.map((row) => table.columns.map((c) => c.csv(row)))
    const content = toCSV(headers, rows)
    const res = await exportFile({ defaultName: `report-${report}-${new Date().toISOString().slice(0, 10)}.csv`, content })
    if (res.saved) toast('Report exported', { type: 'success' })
  }

  const usesPeriod = report === 'period' || report === 'customer'

  return (
    <div className="flex h-full min-h-0">
      <nav className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Reports</div>
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setParams({ r: r.key })}
            className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              report === r.key ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span>{r.icon}</span> {r.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <PageHeader
          title={table.title}
          subtitle={table.subtitle}
          actions={
            <div className="flex items-center gap-2">
              {usesPeriod && (
                <select className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              )}
              <button className="btn-outline" onClick={load} disabled={loading}>↻ Refresh</button>
              <button className="btn-outline" onClick={exportCsv} disabled={loading || !table.rows.length}>⬇ Export CSV</button>
            </div>
          }
        />

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !table.rows.length ? (
          <div className="card px-5 py-10 text-center text-sm text-slate-400">No data for this report.</div>
        ) : (
          <>
            {table.chart && (
              <div className="card mb-5 p-5">
                <BarChart data={table.chart} />
              </div>
            )}
            <div className="card overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    {table.columns.map((c) => (
                      <th key={c.label} className={`px-4 py-3 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      {table.columns.map((c) => (
                        <td key={c.label} className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.strong ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {table.footer && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/50">
                      {table.columns.map((c, i) => (
                        <td key={c.label} className={`px-4 py-3 ${c.align === 'right' ? 'text-right tabular-nums' : ''} text-slate-800 dark:text-slate-100`}>
                          {i === 0 ? 'Total' : c.foot ? c.foot(table.rows) : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---- report builders -------------------------------------------------------
function buildReport(report, { invoices, inPeriod, nameOf, cur }) {
  const money = (v) => formatMoney(v, cur)
  const sum = (rows, f) => rows.reduce((s, r) => s + (toNumber(r[f]) || 0), 0)

  if (report === 'customer') {
    const map = new Map()
    for (const r of inPeriod) {
      const k = String(r.socid ?? r.fk_soc ?? '?')
      const e = map.get(k) || { name: nameOf(r), count: 0, total: 0 }
      e.count += 1
      e.total += toNumber(r.total_ttc) || 0
      map.set(k, e)
    }
    const rows = [...map.values()].sort((a, b) => b.total - a.total)
    return {
      title: 'Sales by Customer', subtitle: 'Invoiced amount per customer (incl. tax)',
      columns: [
        { label: 'Customer', strong: true, render: (r) => r.name, csv: (r) => r.name },
        { label: 'Invoices', align: 'right', render: (r) => r.count, csv: (r) => r.count, foot: (rs) => rs.reduce((s, r) => s + r.count, 0) },
        { label: 'Total', align: 'right', render: (r) => money(r.total), csv: (r) => r.total, foot: (rs) => money(rs.reduce((s, r) => s + r.total, 0)) },
      ],
      rows, footer: true,
    }
  }

  if (report === 'period') {
    const buckets = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), count: 0, total: 0 })
    }
    const idx = new Map(buckets.map((b) => [b.key, b]))
    for (const r of inPeriod) {
      const d = toDate(r.date); if (!d) continue
      const b = idx.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (b) { b.count += 1; b.total += toNumber(r.total_ttc) || 0 }
    }
    return {
      title: 'Sales by Period', subtitle: 'Invoiced amount per month (incl. tax), last 12 months',
      chart: buckets.map((b) => ({ label: b.label, value: b.total, display: money(b.total) })),
      columns: [
        { label: 'Month', strong: true, render: (r) => r.label, csv: (r) => r.label },
        { label: 'Invoices', align: 'right', render: (r) => r.count, csv: (r) => r.count, foot: (rs) => rs.reduce((s, r) => s + r.count, 0) },
        { label: 'Total', align: 'right', render: (r) => money(r.total), csv: (r) => r.total, foot: (rs) => money(rs.reduce((s, r) => s + r.total, 0)) },
      ],
      rows: buckets, footer: true,
    }
  }

  // Receivables reports use ALL unpaid invoices (a running balance).
  const unpaid = invoices.filter(isUnpaid)

  if (report === 'outstanding') {
    const map = new Map()
    for (const r of unpaid) {
      const k = String(r.socid ?? r.fk_soc ?? '?')
      const e = map.get(k) || { name: nameOf(r), count: 0, total: 0 }
      e.count += 1
      e.total += toNumber(r.total_ttc) || 0
      map.set(k, e)
    }
    const rows = [...map.values()].sort((a, b) => b.total - a.total)
    return {
      title: 'Outstanding by Customer', subtitle: 'Unpaid invoice balance per customer',
      columns: [
        { label: 'Customer', strong: true, render: (r) => r.name, csv: (r) => r.name },
        { label: 'Open invoices', align: 'right', render: (r) => r.count, csv: (r) => r.count, foot: (rs) => rs.reduce((s, r) => s + r.count, 0) },
        { label: 'Outstanding', align: 'right', render: (r) => money(r.total), csv: (r) => r.total, foot: (rs) => money(rs.reduce((s, r) => s + r.total, 0)) },
      ],
      rows, footer: true,
    }
  }

  // Aged receivables — per-customer buckets by due date.
  const nowMs = Date.now()
  const map = new Map()
  for (const r of unpaid) {
    const k = String(r.socid ?? r.fk_soc ?? '?')
    const e = map.get(k) || { name: nameOf(r), notDue: 0, d30: 0, d60: 0, d90: 0, total: 0 }
    const amt = toNumber(r.total_ttc) || 0
    const due = toDate(r.date_lim_reglement || r.date_echeance)
    const days = due ? Math.floor((nowMs - due.getTime()) / 86400000) : 0
    if (!due || days <= 0) e.notDue += amt
    else if (days <= 30) e.d30 += amt
    else if (days <= 60) e.d60 += amt
    else e.d90 += amt
    e.total += amt
    map.set(k, e)
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total)
  const col = (label, key) => ({ label, align: 'right', render: (r) => money(r[key]), csv: (r) => r[key], foot: (rs) => money(rs.reduce((s, r) => s + r[key], 0)) })
  return {
    title: 'Aged Receivables', subtitle: 'Unpaid invoices by due date, per customer',
    columns: [
      { label: 'Customer', strong: true, render: (r) => r.name, csv: (r) => r.name },
      col('Not due', 'notDue'), col('1–30', 'd30'), col('31–60', 'd60'), col('60+', 'd90'),
      { label: 'Total', align: 'right', strong: true, render: (r) => money(r.total), csv: (r) => r.total, foot: (rs) => money(rs.reduce((s, r) => s + r.total, 0)) },
    ],
    rows, footer: true,
  }
}
