import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/ipc.js'
import { ENTITIES, recordId } from '../lib/entities.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import { ErrorState, Loading, StatusBadge } from '../components/ui.jsx'
import { formatMoney, toNumber, toDate } from '../lib/format.js'
import { Donut, BarChart, HBars, Legend } from '../components/charts.jsx'

const CAP = 1000 // max records pulled per entity for accurate headline figures

export default function Dashboard() {
  const { activeProfile, activeId } = useProfiles()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [custNames, setCustNames] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const types = Object.keys(ENTITIES)
      const settled = await Promise.all(
        types.map(async (t) => {
          try {
            const { rows, complete } = await api.listAll(t, {
              cap: CAP,
              sortfield: ENTITIES[t].sortfield,
              sortorder: 'DESC',
            })
            return [t, { rows, complete }]
          } catch (e) {
            return [t, { rows: [], complete: true, error: e.message }]
          }
        })
      )
      setData(Object.fromEntries(settled))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, activeId])

  // ---- Derived analytics (memoised) ----------------------------------------
  const stats = useMemo(() => {
    if (!data) return null
    const tp = data.thirdparties?.rows || []
    const inv = data.invoices?.rows || []
    const orders = data.orders?.rows || []
    const proposals = data.proposals?.rows || []
    const products = data.products?.rows || []

    const isUnpaid = (r) => {
      const s = Number(r.status ?? r.statut)
      return Number(r.paye) !== 1 && s !== 0 && s !== 3
    }

    const unpaid = inv.filter(isUnpaid)
    const invoiceTotal = sum(inv, 'total_ttc')
    const unpaidTotal = sum(unpaid, 'total_ttc')
    const orderTotal = sum(orders, 'total_ttc')

    // Invoice status breakdown.
    const buckets = { Paid: 0, Unpaid: 0, Draft: 0, Other: 0 }
    for (const r of inv) {
      const st = ENTITIES.invoices.status(r).label
      if (buckets[st] === undefined) buckets.Other += 1
      else buckets[st] += 1
    }
    const statusSegments = [
      { label: 'Paid', value: buckets.Paid, tone: 'green' },
      { label: 'Unpaid', value: buckets.Unpaid, tone: 'amber' },
      { label: 'Draft', value: buckets.Draft, tone: 'slate' },
      { label: 'Other', value: buckets.Other, tone: 'red' },
    ].filter((s) => s.value > 0)

    // Monthly invoiced (incl. tax) for the trailing 6 months present in data.
    const monthly = buildMonthly(inv, 6)

    // Top customers by invoiced amount (map socid -> third-party name).
    const nameById = new Map()
    for (const t of tp) nameById.set(String(t.id ?? t.rowid), t.name || t.name_alias)
    const bySoc = new Map()
    for (const r of inv) {
      const sid = String(r.socid ?? r.fk_soc ?? '')
      if (!sid) continue
      bySoc.set(sid, (bySoc.get(sid) || 0) + (toNumber(r.total_ttc) || 0))
    }
    const topCustomers = [...bySoc.entries()]
      .map(([sid, val]) => ({
        sid,
        fallback: nameById.get(sid),
        value: val,
        display: formatMoney(val),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    return {
      tp, inv, orders, proposals, products, unpaid,
      invoiceTotal, unpaidTotal, orderTotal,
      statusSegments, monthly, topCustomers,
      errors: {
        thirdparties: data.thirdparties?.error,
        invoices: data.invoices?.error,
        products: data.products?.error,
        orders: data.orders?.error,
        proposals: data.proposals?.error,
      },
    }
  }, [data])

  // Resolve real third-party names for the top customers (best-effort).
  useEffect(() => {
    if (!stats) return
    const ids = stats.topCustomers.map((c) => c.sid).filter(Boolean)
    if (!ids.length) return
    let cancelled = false
    api
      .resolveThirdparties(ids)
      .then((map) => !cancelled && setCustNames((p) => ({ ...p, ...map })))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [stats])

  if (loading) return <Loading label="Loading your dashboard…" />
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>
  if (!stats) return null

  // Count label that flags when the per-type cap was hit (e.g. "1000+").
  const count = (key) => {
    const d = data?.[key]
    const n = d?.rows.length || 0
    return d && d.complete === false ? `${n}+` : String(n)
  }

  // Apply resolved names (from the effect) to the top-customer bars.
  const topItems = stats.topCustomers.map((c) => ({
    label: custNames[String(c.sid)] || c.fallback || `Customer #${c.sid}`,
    value: c.value,
    display: c.display,
  }))

  const navCards = [
    { e: ENTITIES.thirdparties, n: count('thirdparties'), err: stats.errors.thirdparties },
    { e: ENTITIES.invoices, n: count('invoices'), err: stats.errors.invoices },
    { e: ENTITIES.products, n: count('products'), err: stats.errors.products },
    { e: ENTITIES.orders, n: count('orders'), err: stats.errors.orders },
    { e: ENTITIES.proposals, n: count('proposals'), err: stats.errors.proposals },
  ]

  // If every record type failed, this is a connection/auth problem — not an
  // empty company. Surface it clearly rather than showing all-zero figures.
  const errorList = Object.values(stats.errors).filter(Boolean)
  const allFailed = errorList.length === Object.keys(stats.errors).length

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">{activeProfile?.name}</span> · across your data (up to {CAP.toLocaleString()} records per type)
          </p>
        </div>
        <button className="btn-outline" onClick={load}>↻ Refresh</button>
      </div>

      {/* Connection error banner */}
      {allFailed && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">Couldn't reach Dolibarr</div>
            <div className="mt-0.5 text-sm text-rose-600 dark:text-rose-400">
              No data could be loaded — this usually means the API URL is wrong, the key/token is invalid, or the server is unreachable. The figures below are not real.
            </div>
            <div className="mt-1 text-xs text-rose-500/80">{errorList[0]}</div>
            <button className="btn-outline mt-2" onClick={load}>↻ Retry</button>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon="💰" tone="brand" label="Invoiced (incl. tax)" value={formatMoney(stats.invoiceTotal)} hint={`${stats.inv.length} invoices`} />
        <KpiCard icon="⏳" tone="amber" label="Outstanding" value={formatMoney(stats.unpaidTotal)} hint={`${stats.unpaid.length} unpaid`} />
        <KpiCard icon="📑" tone="emerald" label="Orders (incl. tax)" value={formatMoney(stats.orderTotal)} hint={`${stats.orders.length} orders`} />
        <KpiCard icon="🏢" tone="violet" label="Third parties" value={count('thirdparties')} hint="customers & suppliers" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Invoice status">
          {stats.statusSegments.length === 0 ? (
            <Empty>No invoices to chart.</Empty>
          ) : (
            <div className="flex items-center gap-6">
              <Donut
                segments={stats.statusSegments}
                centerValue={stats.inv.length}
                centerLabel="invoices"
              />
              <div className="flex-1">
                <Legend items={stats.statusSegments.map((s) => ({ label: s.label, value: s.value, tone: s.tone }))} />
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Monthly invoiced (incl. tax)">
          {stats.monthly.some((m) => m.value > 0) ? (
            <BarChart data={stats.monthly} />
          ) : (
            <Empty>Not enough dated invoices to chart.</Empty>
          )}
        </Panel>
      </div>

      {/* Top customers + recent invoices */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Top customers by invoiced amount">
          {topItems.length ? (
            <HBars items={topItems} />
          ) : (
            <Empty>No customer invoice data.</Empty>
          )}
        </Panel>

        <RecentPanel
          title="Latest invoices"
          entity={ENTITIES.invoices}
          rows={stats.inv.slice(0, 6)}
          onOpen={(r) => navigate(`/records/invoices/${recordId(r)}`)}
          right={(r) => formatMoney(r.total_ttc, r.multicurrency_code)}
        />
      </div>

      {/* Quick navigation */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {navCards.map((c) => (
          <button
            key={c.e.key}
            onClick={() => navigate(`/records/${c.e.key}`)}
            className="card flex items-center gap-3 p-4 text-left transition hover:border-brand-300 hover:shadow"
          >
            <span className="text-2xl">{c.e.icon}</span>
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">{c.err ? '—' : c.n}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{c.e.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---- helpers ---------------------------------------------------------------

function sum(rows, field) {
  return rows.reduce((s, r) => s + (toNumber(r[field]) || 0), 0)
}

// Build trailing-N-month buckets of invoiced total (incl. tax).
function buildMonthly(invoices, months) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      value: 0,
    })
  }
  const index = new Map(buckets.map((b) => [b.key, b]))
  for (const r of invoices) {
    const d = toDate(r.date || r.datec || r.date_creation)
    if (!d) continue
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const b = index.get(key)
    if (b) b.value += toNumber(r.total_ttc) || 0
  }
  return buckets.map((b) => ({ ...b, display: formatMoney(b.value) }))
}

// ---- presentational --------------------------------------------------------

function KpiCard({ icon, label, value, hint, tone }) {
  const ring = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
  }
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${ring[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{value}</div>
        <div className="truncate text-xs text-slate-400">{hint}</div>
      </div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="card p-5">
      <div className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <div className="py-8 text-center text-sm text-slate-400">{children}</div>
}

function RecentPanel({ title, entity, rows, onOpen, right }) {
  return (
    <div className="card">
      <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">{title}</div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">No records.</div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => {
            const status = entity.status(r)
            return (
              <li
                key={recordId(r)}
                className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-brand-50/50 dark:hover:bg-slate-800/50"
                onClick={() => onOpen(r)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{entity.title(r)}</div>
                  <div className="truncate text-xs text-slate-400">{entity.subtitle(r)}</div>
                </div>
                <div className="text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">{right(r)}</div>
                <StatusBadge label={status.label} tone={status.tone} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
