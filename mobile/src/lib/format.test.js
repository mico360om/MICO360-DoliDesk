import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  toNumber, formatMoney, formatMoneyShort, formatNumber, toDate, formatDate,
  recordMoney, lineMoney, dateInRange, humanizeKey, setBaseCurrency, getBaseCurrency,
} from './format.js'

afterEach(() => {
  setBaseCurrency(null)
  vi.useRealTimers()
})

describe('toNumber', () => {
  it('parses numbers and numeric strings, rejects junk', () => {
    expect(toNumber(12)).toBe(12)
    expect(toNumber('12.5')).toBe(12.5)
    expect(toNumber('')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber('abc')).toBeNull()
  })
})

describe('formatMoney', () => {
  it('dashes empty, formats with 2 decimals', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(1234.5)).toMatch(/1.234\.50/)
  })
  it('uses explicit then base currency', () => {
    expect(formatMoney(1000, 'OMR')).toMatch(/OMR/)
    setBaseCurrency('usd')
    expect(getBaseCurrency()).toBe('USD')
    expect(formatMoney(1000)).toMatch(/\$|USD/)
  })
})

describe('formatMoneyShort', () => {
  it('compacts large, keeps small in full, dashes empty', () => {
    expect(formatMoneyShort(4159082.77, 'OMR')).toMatch(/M/)
    expect(formatMoneyShort(1500)).toMatch(/1.500\.00/)
    expect(formatMoneyShort(null)).toBe('—')
  })
})

describe('formatNumber', () => {
  it('groups thousands, dashes empty', () => {
    expect(formatNumber(12345)).toMatch(/12.345/)
    expect(formatNumber(null)).toBe('—')
  })
})

describe('toDate', () => {
  it('handles unix seconds, ms, ISO, and invalid', () => {
    expect(toDate('1719273600').getUTCFullYear()).toBe(2024)
    expect(toDate('1719273600000').getUTCFullYear()).toBe(2024)
    expect(toDate('2024-01-15').getUTCFullYear()).toBe(2024)
    expect(toDate('')).toBeNull()
    expect(toDate('not-a-date')).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats timestamps, dashes empty, passes unparseable through', () => {
    expect(formatDate('1719273600')).toMatch(/2024/)
    expect(formatDate('')).toBe('—')
    expect(formatDate('0000-00-00')).toBe('0000-00-00')
  })
})

describe('recordMoney', () => {
  it('shows foreign currency for multicurrency docs, base otherwise', () => {
    setBaseCurrency('OMR')
    expect(recordMoney({ total_ttc: '380', multicurrency_code: 'USD', multicurrency_total_ttc: '1000' }, 'total_ttc')).toMatch(/\$|USD/)
    expect(recordMoney({ total_ttc: '380', multicurrency_code: 'OMR', multicurrency_total_ttc: '380' }, 'total_ttc')).toMatch(/OMR/)
    expect(recordMoney(null, 'total_ttc')).toBe('—')
  })
})

describe('dateInRange', () => {
  it('respects today / week / month / all and rejects invalid', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const today = Math.floor(new Date('2026-06-15T08:00:00Z').getTime() / 1000)
    const lastMonth = Math.floor(new Date('2026-05-10T00:00:00Z').getTime() / 1000)
    expect(dateInRange(today, 'all')).toBe(true)
    expect(dateInRange(today, 'today')).toBe(true)
    expect(dateInRange(lastMonth, 'today')).toBe(false)
    expect(dateInRange(lastMonth, 'month')).toBe(false)
    expect(dateInRange(today, 'month')).toBe(true)
    expect(dateInRange(lastMonth, 'year')).toBe(true)
    expect(dateInRange('', 'today')).toBe(false)
  })
})

describe('lineMoney', () => {
  it('uses the document currency for foreign-currency lines', () => {
    setBaseCurrency('OMR')
    const rec = { multicurrency_code: 'USD' }
    expect(lineMoney({ total_ht: '380', multicurrency_total_ht: '1000' }, rec, 'total_ht')).toMatch(/\$|USD/)
    expect(lineMoney({ total_ht: '380' }, { multicurrency_code: 'OMR' }, 'total_ht')).toMatch(/OMR/)
  })
})

describe('humanizeKey', () => {
  it('title-cases snake_case and camelCase', () => {
    expect(humanizeKey('date_lim_reglement')).toBe('Date Lim Reglement')
    expect(humanizeKey('totalTtc')).toBe('Total Ttc')
  })
})
