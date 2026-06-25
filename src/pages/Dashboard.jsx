import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/ipc.js'
import { ENTITIES, recordId } from '../lib/entities.js'
import { useProfiles } from '../context/ProfileContext.jsx'
import { CardsSkeleton, ErrorState, Skeleton, StatusBadge } from '../components/ui.jsx'
import { formatMoney, recordMoney, toNumber, toDate } from '../lib/format.js'
import { Donut, BarChart, HBars, Legend } from '../components/charts.jsx'

const CAP = 1000 // max records pulled per entity for accurate headline figures

const PERIODS = [
  ['all', 'All time'],
  ['year', 'This year'],
  ['quarter', 'This quarter'],
  ['month', 'This month'],
]

// Start of the current period and the equivalent previous period (for deltas).
function periodBounds(period) {
  if (period === 'all') return { start: null, prevStart: null }
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (period === 'month') return { start: new Date(y, m, 1), prevStart: new Date(y, m - 1, 1) }
  if (period === 'quarter') {
    const q = Math.floor(m / 3) * 3
    return { start: new Date(y, q, 1), prevStart: new Date(y, q - 3, 1) }
  }
  return { start: new Date(y, 0, 1), prevStart: new Date(y - 1, 0, 1) } // year
}

function inWindow(v, from, to) {
  const d = toDate(v)
  if (!d) return false
  const t = d.getTime()
  return (!from || t >= from.getTime()) && (!to || t < to.getTime())
}

export default function Dashboard() {
  const { activeProfile, activeId, company } = useProfiles()
  const baseCurrency = company?.currency_code || company?.currency || undefined
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [custNames, setCustNames] = useState({})
  const [period, setPeriod] = useState('all')

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

  useEffect(() => { load() }, [load, activeId])

  const stats = useMemo(() => {
    if (!data) return null
    const tp = data.thirdparties?.rows || []
    const invAll = data.invoices?.rows || []
    const ordAll = data.orders?.rows || []
    const propAll = data.proposals?.rows || []
    const products = data.products?.rows || []
    const { start, prevStart } = periodBounds(period)

    const inv = start ? invAll.filter((r) => inWindow(r.date, start, null)) : invAll
    const invPrev = start ? invAll.filter((r) => inWindow(r.date, prevStart, start)) : []
    const orders = start ? ordAll.filter((r) => inWindow(r.date_commande || r.date, start, null)) : ordAll
    const ordersPrev = start ? ordAll.filter((r) => inWindow(r.date_commande || r.date, prevStart, start)) : []

    const isUnpaid = (r) => {
      const s = Number(r.status ?? r.statut)
      return Number(r.paye) !== 1 && s !== 0 && s !== 3
    }

    const invoiceTotal = sum(inv, 'total_ttc')
    const orderTotal = sum(orders, 'total_ttc')
    const avgInvoice = inv.length ? invoiceTotal / inv.length : 0
    const delta = (cur, prev) => (prev > 0 ? (cur - prev) / prev : null)

    // Outstanding = all unpaid invoices (a running balance, not period-bound).
    const unpaid = invAll.filter(isUnpaid)
    const unpaidTotal = sum(unpaid, 'total_ttc')

    // Receivables aging by due date.
    const now = Date.now()
    const buckets = [
      { label: 'Not due', tone: 'slate', value: 0 },
      { label: '1–30 days', tone: 'amber', value: 0 },
      { label: '31–60 days', tone: 'amber', value: 0 },
      { label: '60+ days', tone: 'red', value: 0 },
    ]
    for (const r of unpaid) {
      const due = toDate(r.date_lim_reglement || r.date_echeance)
      const amt = toNumber(r.total_ttc) || 0
      if (!due) { buckets[0].value += amt; continue }
      const days = Math.floor((now - due.getTime()) / 86400000)
      if (days <= 0) buckets[0].value += amt
      else if (days <= 30) buckets[1].value += amt
      else if (days <= 60) buckets[2].value += amt
      else buckets[3].value += amt
    }
    const aging = buckets.map((b) => ({ ...b, display: formatMoney(b.value, baseCurrency) }))

    // Invoice status breakdown (current period).
    const sb = { Paid: 0, Unpaid: 0, Draft: 0, Other: 0 }
    for (const r of inv) {
      const st = ENTITIES.invoices.status(r).label
      if (sb[st] === undefined) sb.Other += 1
      else sb[st] += 1
    }
    const statusSegments = [
      { label: 'Paid', value: sb.Paid, tone: 'green' },
      { label: 'Unpaid', value: sb.Unpaid, tone: 'amber' },
      { label: 'Draft', value: sb.Draft, tone: 'slate' },
      { label: 'Other', value: sb.Other, tone: 'red' },
    ].filter((s) => s.value > 0)

    // Trailing 6 months (independent of the period selector).
    const monthly = buildMonthly(invAll, 6, baseCurrency)

    // Top customers (current period).
    const nameById = new Map()
    for (const t of tp) nameById.set(String(t.id ?? t.rowid), t.name || t.name_alias)
    const bySoc = new Map()
    for (const r of inv) {
      const sid = String(r.socid ?? r.fk_soc ?? '')
      if (!sid) continue
      bySoc.set(sid, (bySoc.get(sid) || 0) + (toNumber(r.total_ttc) || 0))
    }
    const topCustomers = [...bySoc.entries()]
      .map(([sid, val]) => ({ sid, fallback: nameById.get(sid), value: val, display: formatMoney(val, baseCurrency) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // Sales pipeline: open proposals → orders → invoiced (current period).
    const openProposals = propAll.filter((r) => Number(r.status ?? r.statut) === 1)
    const pipeline = [
      { label: 'Open proposals', value: sum(openProposals, 'total_ttc'), count: openProposals.length },
      { label: 'Orders', value: orderTotal, count: orders.length },
      { label: 'Invoiced', value: invoiceTotal, count: inv.length },
    ]

    return {
      tp, inv, orders, products, proposals: propAll, unpaid,
      invoiceTotal, orderTotal, unpaidTotal, avgInvoice,
      invoiceDelta: start ? delta(invoiceTotal, sum(invPrev, 'total_ttc')) : null,
      orderDelta: start ? delta(orderTotal, sum(ordersPrev, 'total_ttc')) : null,
      aging, statusSegments, monthly, topCustomers, pipeline,
      errors: {
        thirdparties: data.thirdparties?.error,
        invoices: data.invoices?.error,
        products: data.products?.error,
        orders: data.orders?.error,
        proposals: data.proposals?.error,
      },
    }
  }, [data, baseCurrency, period])

  useEffect(() => {
    if (!stats) return
    const ids = stats.topCustomers.map((c) => c.sid).filter(Boolean)
    if (!ids.length) return
    let cancelled = false
    api.resolveThirdparties(ids).then((m) => !cancelled && setCustNames((p) => ({ ...p, ...m }))).catch(() => {})
    return () => { cancelled = true }
  }, [stats])

  if (loading)
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-7 w-48" />
        <CardsSkeleton count={4} />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>
  if (!stats) return null

  const count = (key) => {
    const d = data?.[key]
    const n = d?.rows.length || 0
    return d && d.complete === false ? `${n}+` : String(n)
  }
  const topItems = stats.topCustomers.map((c) => ({
    label: custNames[String(c.sid)] || c.fallback || `Customer #${c.sid}`,
    value: c.value,
    display: c.display,
  }))
  const periodLabel = (PERIODS.find(([v]) => v === period) || [])[1]
  const errorList = Object.values(stats.errors).filter(Boolean)
  const allFailed = errorList.length === Object.keys(stats.errors).length

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">{activeProfile?.name}</span> · up to {CAP.toLocaleString()} records per type
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn-outline" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {allFailed && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">Couldn't reach Dolibarr</div>
            <div className="mt-0.5 text-sm text-rose-600 dark:text-rose-400">
              No data could be loaded — check the API URL, key/token, or that the server is reachable. The figures below are not real.
            </div>
            <div className="mt-1 text-xs text-rose-500/80">{errorList[0]}</div>
            <button className="btn-outline mt-2" onClick={load}>↻ Retry</button>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon="💰" tone="brand" label="Invoiced (incl. tax)" value={formatMoney(stats.invoiceTotal, baseCurrency)} hint={`${stats.inv.length} invoices`} delta={stats.invoiceDelta} />
        <KpiCard icon="⏳" tone="amber" label="Outstanding" value={formatMoney(stats.unpaidTotal, baseCurrency)} hint={`${stats.unpaid.length} unpaid`} />
        <KpiCard icon="📑" tone="emerald" label="Orders (incl. tax)" value={formatMoney(stats.orderTotal, baseCurrency)} hint={`${stats.orders.length} orders`} delta={stats.orderDelta} />
        <KpiCard icon="🧾" tone="violet" label="Avg. invoice" value={formatMoney(stats.avgInvoice, baseCurrency)} hint={period === 'all' ? 'all invoices' : periodLabel.toLowerCase()} />
      </div>

      {/* Aging + pipeline */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Receivables aging" subtitle="Unpaid invoices by due date">
          {stats.aging.some((a) => a.value > 0) ? (
            <HBars items={stats.aging.map((a) => ({ label: a.label, value: a.value, display: a.display }))} tone="amber" />
          ) : (
            <Empty>No outstanding invoices. 🎉</Empty>
          )}
        </Panel>

        <Panel title="Sales pipeline" subtitle={period === 'all' ? 'all time' : periodLabel.toLowerCase()}>
          <div className="flex items-stretch gap-2">
            {stats.pipeline.map((step, i) => (
              <div key={step.label} className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{step.label}</div>
                  <div className="mt-1 text-base font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatMoney(step.value, baseCurrency)}</div>
                  <div className="text-xs text-slate-400">{step.count} record{step.count === 1 ? '' : 's'}</div>
                </div>
                {i < stats.pipeline.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Invoice status" subtitle={period === 'all' ? undefined : periodLabel.toLowerCase()}>
          {stats.statusSegments.length === 0 ? (
            <Empty>No invoices to chart.</Empty>
          ) : (
            <div className="flex items-center gap-6">
              <Donut segments={stats.statusSegments} centerValue={stats.inv.length} centerLabel="invoices" />
              <div className="flex-1">
                <Legend items={stats.statusSegments.map((s) => ({ label: s.label, value: s.value, tone: s.tone }))} />
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Monthly invoiced (incl. tax)" subtitle="last 6 months">
          {stats.monthly.some((m) => m.value > 0) ? <BarChart data={stats.monthly} /> : <Empty>Not enough dated invoices to chart.</Empty>}
        </Panel>
      </div>

      {/* Top customers + recent invoices */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Top customers" subtitle="by invoiced amount">
          {topItems.length ? <HBars items={topItems} /> : <Empty>No customer invoice data.</Empty>}
        </Panel>

        <RecentPanel
          title="Latest invoices"
          entity={ENTITIES.invoices}
          rows={stats.inv.slice(0, 6)}
          onOpen={(r) => navigate(`/records/invoices/${recordId(r)}`)}
          right={(r) => recordMoney(r, 'total_ttc')}
        />
      </div>

      {/* Quick navigation */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { e: ENTITIES.thirdparties, err: stats.errors.thirdparties },
          { e: ENTITIES.invoices, err: stats.errors.invoices },
          { e: ENTITIES.products, err: stats.errors.products },
          { e: ENTITIES.orders, err: stats.errors.orders },
          { e: ENTITIES.proposals, err: stats.errors.proposals },
        ].map((c) => (
          <button
            key={c.e.key}
            onClick={() => navigate(`/records/${c.e.key}`)}
            className="card flex items-center gap-3 p-4 text-left transition hover:border-brand-300 hover:shadow"
          >
            <span className="text-2xl">{c.e.icon}</span>
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">{c.err ? '—' : count(c.e.key)}</span>
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

function buildMonthly(invoices, months, currency) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: 'short' }), value: 0 })
  }
  const index = new Map(buckets.map((b) => [b.key, b]))
  for (const r of invoices) {
    const d = toDate(r.date || r.datec || r.date_creation)
    if (!d) continue
    const b = index.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (b) b.value += toNumber(r.total_ttc) || 0
  }
  return buckets.map((b) => ({ ...b, display: formatMoney(b.value, currency) }))
}

// ---- presentational --------------------------------------------------------

function KpiCard({ icon, label, value, hint, tone, delta }) {
  const ring = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
  }
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${ring[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{value}</div>
        <div className="flex items-center gap-1.5 text-xs">
          {delta != null && (
            <span className={`font-semibold ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(0)}%
            </span>
          )}
          <span className="truncate text-slate-400">{hint}</span>
        </div>
      </div>
    </div>
  )
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</div>
        {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
      </div>
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
