// Pure report builders (ported from the desktop Reports page). Each returns a
// table description { title, subtitle, columns, rows, footer, chart? } where
// columns render to plain strings for the mobile <Text>-based table.

import { formatMoney, toDate, toNumber } from './format.js'

export const REPORTS = [
  { key: 'period', label: 'By Period', icon: '📅' },
  { key: 'customer', label: 'By Customer', icon: '🏢' },
  { key: 'aging', label: 'Aged', icon: '⏳' },
  { key: 'outstanding', label: 'Outstanding', icon: '💰' },
]

export const PERIODS = [['all', 'All time'], ['year', 'This year'], ['quarter', 'This quarter'], ['month', 'This month']]

export const isUnpaid = (r) => {
  const s = Number(r.status ?? r.statut)
  return Number(r.paye) !== 1 && s !== 0 && s !== 3
}

export function periodStart(p, now = new Date()) {
  if (p === 'all') return null
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (p === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  return new Date(now.getFullYear(), 0, 1)
}

export function buildReport(report, { invoices = [], names = {}, period = 'all', cur, now = new Date() } = {}) {
  const money = (v) => formatMoney(v, cur)
  const nameOf = (r) => names[String(r.socid ?? r.fk_soc ?? '')] || `Customer #${r.socid ?? r.fk_soc ?? '?'}`

  const start = periodStart(period, now)
  const inPeriod = start ? invoices.filter((r) => { const d = toDate(r.date); return d && d.getTime() >= start.getTime() }) : invoices

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
        { label: 'Customer', grow: true, render: (r) => r.name },
        { label: 'Inv.', align: 'right', render: (r) => String(r.count), foot: (rs) => String(rs.reduce((s, r) => s + r.count, 0)) },
        { label: 'Total', align: 'right', render: (r) => money(r.total), foot: (rs) => money(rs.reduce((s, r) => s + r.total, 0)) },
      ],
      rows, footer: true,
    }
  }

  if (report === 'period') {
    const buckets = []
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
      title: 'Sales by Period', subtitle: 'Invoiced per month (incl. tax), last 12 months',
      chart: buckets.map((b) => ({ label: b.label, value: b.total, display: money(b.total) })),
      columns: [
        { label: 'Month', grow: true, render: (r) => r.label },
        { label: 'Inv.', align: 'right', render: (r) => String(r.count), foot: (rs) => String(rs.reduce((s, r) => s + r.count, 0)) },
        { label: 'Total', align: 'right', render: (r) => money(r.total), foot: (rs) => money(rs.reduce((s, r) => s + r.total, 0)) },
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
        { label: 'Customer', grow: true, render: (r) => r.name },
        { label: 'Open', align: 'right', render: (r) => String(r.count), foot: (rs) => String(rs.reduce((s, r) => s + r.count, 0)) },
        { label: 'Outstanding', align: 'right', render: (r) => money(r.total), foot: (rs) => money(rs.reduce((s, r) => s + r.total, 0)) },
      ],
      rows, footer: true,
    }
  }

  // Aged receivables — per-customer buckets by due date.
  const nowMs = now.getTime()
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
  const col = (label, key) => ({ label, align: 'right', render: (r) => money(r[key]), foot: (rs) => money(rs.reduce((s, r) => s + r[key], 0)) })
  return {
    title: 'Aged Receivables', subtitle: 'Unpaid invoices by due date',
    columns: [
      { label: 'Customer', grow: true, render: (r) => r.name },
      col('Not due', 'notDue'), col('1–30', 'd30'), col('31–60', 'd60'), col('60+', 'd90'),
    ],
    rows, footer: true,
  }
}
