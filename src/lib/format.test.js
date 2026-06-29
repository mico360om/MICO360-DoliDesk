import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  toNumber, formatMoney, formatMoneyShort, formatNumber, toDate, formatDate,
  dateInRange, recordMoney, lineMoney, extraFields, humanizeKey,
  setBaseCurrency, getBaseCurrency,
} from './format.js'

afterEach(() => {
  setBaseCurrency(null)
  vi.useRealTimers()
})

describe('toNumber', () => {
  it('parses numbers and numeric strings', () => {
    expect(toNumber(12)).toBe(12)
    expect(toNumber('12.5')).toBe(12.5)
    expect(toNumber('-3')).toBe(-3)
  })
  it('returns null for empty / non-numeric', () => {
    expect(toNumber('')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber(undefined)).toBeNull()
    expect(toNumber('abc')).toBeNull()
  })
})

describe('formatMoney', () => {
  it('formats with two decimals and a dash for empty', () => {
    expect(formatMoney('')).toBe('—')
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(1234.5)).toMatch(/1.234\.50/)
  })
  it('includes the currency code when given', () => {
    expect(formatMoney(1000, 'OMR')).toMatch(/OMR/)
  })
  it('renders a plain grouped number when no currency is supplied', () => {
    // formatMoney itself is currency-agnostic; callers pass the base currency.
    expect(formatMoney(1000)).toMatch(/1.000\.00/)
    expect(formatMoney(1000)).not.toMatch(/[A-Z]{3}/)
  })
  it('base currency is normalised to upper-case for callers to use', () => {
    setBaseCurrency('usd')
    expect(getBaseCurrency()).toBe('USD')
    expect(formatMoney(1000, getBaseCurrency())).toMatch(/\$|USD/)
  })
})

describe('formatMoneyShort', () => {
  it('compacts large amounts', () => {
    expect(formatMoneyShort(4159082.77, 'OMR')).toMatch(/M/)
  })
  it('keeps small amounts in full', () => {
    expect(formatMoneyShort(1500)).toMatch(/1.500\.00/)
  })
  it('handles empty', () => {
    expect(formatMoneyShort(null)).toBe('—')
  })
})

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(12345)).toMatch(/12.345/)
    expect(formatNumber(null)).toBe('—')
  })
})

describe('toDate', () => {
  it('parses unix seconds (10-digit)', () => {
    const d = toDate('1719273600')
    expect(d).toBeInstanceOf(Date)
    expect(d.getUTCFullYear()).toBe(2024)
  })
  it('parses unix milliseconds (13-digit)', () => {
    const d = toDate('1719273600000')
    expect(d.getUTCFullYear()).toBe(2024)
  })
  it('parses ISO strings', () => {
    expect(toDate('2024-01-15').getUTCFullYear()).toBe(2024)
  })
  it('returns null for invalid / empty', () => {
    expect(toDate('')).toBeNull()
    expect(toDate('not-a-date')).toBeNull()
    expect(toDate(null)).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats a unix timestamp', () => {
    expect(formatDate('1719273600')).toMatch(/2024/)
  })
  it('dashes empty and passes through unparseable', () => {
    expect(formatDate('')).toBe('—')
    expect(formatDate('0000-00-00')).toBe('0000-00-00')
  })
})

describe('dateInRange', () => {
  it('respects today / week / month / all', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const today = Math.floor(new Date('2026-06-15T08:00:00Z').getTime() / 1000)
    const lastMonth = Math.floor(new Date('2026-05-10T00:00:00Z').getTime() / 1000)
    expect(dateInRange(today, 'today')).toBe(true)
    expect(dateInRange(lastMonth, 'today')).toBe(false)
    expect(dateInRange(lastMonth, 'month')).toBe(false)
    expect(dateInRange(lastMonth, 'all')).toBe(true)
    expect(dateInRange(today, 'month')).toBe(true)
    expect(dateInRange('', 'today')).toBe(false)
  })
})

describe('recordMoney / lineMoney (multi-currency)', () => {
  it('shows the document currency for foreign-currency records', () => {
    setBaseCurrency('OMR')
    const inv = { total_ttc: '380', multicurrency_code: 'USD', multicurrency_total_ttc: '1000' }
    expect(recordMoney(inv, 'total_ttc')).toMatch(/\$|USD/)
  })
  it('shows the base currency when the doc matches base', () => {
    setBaseCurrency('OMR')
    const inv = { total_ttc: '380', multicurrency_code: 'OMR', multicurrency_total_ttc: '380' }
    expect(recordMoney(inv, 'total_ttc')).toMatch(/OMR/)
  })
  it('lineMoney mirrors recordMoney for foreign currency', () => {
    setBaseCurrency('OMR')
    const rec = { multicurrency_code: 'USD' }
    const line = { total_ht: '380', multicurrency_total_ht: '1000' }
    expect(lineMoney(line, rec, 'total_ht')).toMatch(/\$|USD/)
  })
})

describe('extraFields', () => {
  it('extracts non-empty options_ fields and humanizes labels', () => {
    const r = { array_options: { options_color: 'red', options_size: '', options_obj: {} } }
    const f = extraFields(r)
    expect(f).toHaveLength(1)
    expect(f[0].label).toBe('Color')
    expect(f[0].value).toBe('red')
  })
  it('returns [] when no extrafields', () => {
    expect(extraFields({})).toEqual([])
    expect(extraFields(null)).toEqual([])
  })
})

describe('humanizeKey', () => {
  it('title-cases snake_case and camelCase', () => {
    expect(humanizeKey('date_lim_reglement')).toBe('Date Lim Reglement')
    expect(humanizeKey('totalTtc')).toBe('Total Ttc')
  })
})
