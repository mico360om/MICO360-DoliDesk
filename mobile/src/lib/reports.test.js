import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReport, isUnpaid, periodStart } from './reports.js'
import { setBaseCurrency } from './format.js'

afterEach(() => { setBaseCurrency(null); vi.useRealTimers() })

const NOW = new Date('2026-06-15T12:00:00Z')
const ymd = (s) => Math.floor(new Date(s).getTime() / 1000)

// socid 1 = Acme, 2 = Globex
const NAMES = { 1: 'Acme', 2: 'Globex' }
const INVOICES = [
  { socid: 1, date: ymd('2026-06-01'), total_ttc: '100', status: 2, paye: 1 }, // paid, this month
  { socid: 1, date: ymd('2026-05-01'), total_ttc: '50', status: 1, paye: 0, date_lim_reglement: ymd('2026-05-20') }, // unpaid, ~26d overdue
  { socid: 2, date: ymd('2026-01-10'), total_ttc: '200', status: 1, paye: 0, date_lim_reglement: ymd('2026-01-20') }, // unpaid, long overdue
  { socid: 2, date: ymd('2025-12-01'), total_ttc: '300', status: 0, paye: 0 }, // draft → excluded from unpaid
]

describe('isUnpaid', () => {
  it('excludes paid, draft and abandoned', () => {
    expect(isUnpaid({ status: 1, paye: 0 })).toBe(true)
    expect(isUnpaid({ status: 2, paye: 1 })).toBe(false)
    expect(isUnpaid({ status: 0 })).toBe(false)
    expect(isUnpaid({ status: 3 })).toBe(false)
  })
})

describe('periodStart', () => {
  it('computes month/quarter/year starts and null for all', () => {
    // Local-time dates (toISOString would shift by the test runner's tz); compare local parts.
    const local = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    expect(periodStart('all', NOW)).toBeNull()
    expect(local(periodStart('month', NOW))).toBe('2026-6-1')
    expect(local(periodStart('quarter', NOW))).toBe('2026-4-1')
    expect(local(periodStart('year', NOW))).toBe('2026-1-1')
  })
})

describe('buildReport: customer', () => {
  it('totals invoiced per customer, sorted desc, with a footer total', () => {
    const t = buildReport('customer', { invoices: INVOICES, names: NAMES, period: 'all', cur: 'OMR', now: NOW })
    expect(t.rows[0].name).toBe('Globex') // 200+300=500 > Acme 150
    expect(t.rows[0].total).toBe(500)
    const totalCol = t.columns[2]
    expect(totalCol.foot(t.rows)).toMatch(/650/) // 150 + 500
  })
})

describe('buildReport: period', () => {
  it('produces 12 monthly buckets and a chart', () => {
    const t = buildReport('period', { invoices: INVOICES, names: NAMES, period: 'all', cur: 'OMR', now: NOW })
    expect(t.rows).toHaveLength(12)
    expect(t.chart).toHaveLength(12)
    const june = t.rows[t.rows.length - 1]
    expect(june.label).toMatch(/Jun/)
    expect(june.total).toBe(100) // only the paid June invoice has date in June; counts all invoices though
  })
})

describe('buildReport: outstanding', () => {
  it('sums only unpaid invoices per customer', () => {
    const t = buildReport('outstanding', { invoices: INVOICES, names: NAMES, cur: 'OMR', now: NOW })
    const byName = Object.fromEntries(t.rows.map((r) => [r.name, r.total]))
    expect(byName.Globex).toBe(200) // the 300 draft is excluded
    expect(byName.Acme).toBe(50)
  })
})

describe('buildReport: aging', () => {
  it('buckets unpaid invoices by overdue days', () => {
    const t = buildReport('aging', { invoices: INVOICES, names: NAMES, cur: 'OMR', now: NOW })
    const acme = t.rows.find((r) => r.name === 'Acme')
    const globex = t.rows.find((r) => r.name === 'Globex')
    expect(acme.d30).toBe(50)   // ~26 days overdue
    expect(globex.d90).toBe(200) // ~140 days overdue
  })
})
