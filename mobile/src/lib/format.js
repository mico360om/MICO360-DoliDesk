// Formatting helpers (ported from the desktop app). Dolibarr returns numbers
// as strings and dates as unix seconds; these normalise for display.

let BASE_CURRENCY = null
export function setBaseCurrency(code) {
  BASE_CURRENCY = code ? String(code).toUpperCase() : null
}
export function getBaseCurrency() {
  return BASE_CURRENCY
}

export function toNumber(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

export function formatMoney(v, currency) {
  const n = toNumber(v)
  if (n === null) return '—'
  const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  const cur = currency || BASE_CURRENCY
  if (cur) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, ...opts }).format(n)
    } catch {
      /* fall through */
    }
  }
  return new Intl.NumberFormat(undefined, opts).format(n)
}

export function formatMoneyShort(v, currency) {
  const n = toNumber(v)
  if (n === null) return '—'
  if (Math.abs(n) >= 100000) {
    const opts = { notation: 'compact', maximumFractionDigits: 2 }
    const cur = currency || BASE_CURRENCY
    if (cur) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, ...opts }).format(n)
      } catch {
        /* */
      }
    }
    return new Intl.NumberFormat(undefined, opts).format(n)
  }
  return formatMoney(n, currency)
}

export function formatNumber(v) {
  const n = toNumber(v)
  if (n === null) return '—'
  return new Intl.NumberFormat().format(n)
}

export function toDate(v) {
  if (v === null || v === undefined || v === '') return null
  let d
  const n = toNumber(v)
  if (n !== null && /^\d+$/.test(String(v).trim())) {
    d = new Date(String(v).length > 10 ? n : n * 1000)
  } else {
    d = new Date(v)
  }
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(v) {
  if (v === null || v === undefined || v === '') return '—'
  const d = toDate(v)
  if (!d) return String(v)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

// Per-record amount in the right currency (foreign-currency docs show their own).
export function recordMoney(record, field) {
  if (!record) return '—'
  const mc = record.multicurrency_code
  const mcVal = record['multicurrency_' + field]
  if (mc && BASE_CURRENCY && mc !== BASE_CURRENCY && mcVal !== null && mcVal !== undefined && mcVal !== '') {
    return formatMoney(mcVal, mc)
  }
  return formatMoney(record[field], BASE_CURRENCY || mc)
}

export function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
