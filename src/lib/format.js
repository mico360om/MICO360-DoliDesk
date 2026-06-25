// Dolibarr returns numbers and dates as strings (and dates often as unix
// timestamps in seconds). These helpers normalise them for display.

export function toNumber(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

// The company's base currency (from /setup/company). Set once the active
// profile's company info loads; used to label aggregate totals and to decide
// when a document is in a foreign currency.
let BASE_CURRENCY = null
export function setBaseCurrency(code) {
  BASE_CURRENCY = code ? String(code).toUpperCase() : null
}
export function getBaseCurrency() {
  return BASE_CURRENCY
}

// Format a record's amount in the correct currency. Dolibarr stores base-
// currency totals in `total_ht`/`total_ttc` and the document-currency totals
// in `multicurrency_total_ht`/`multicurrency_total_ttc`. When the document is
// in a foreign currency we show its own amount + code; otherwise the base.
export function recordMoney(record, field) {
  if (!record) return '—'
  const mc = record.multicurrency_code
  const mcVal = record['multicurrency_' + field]
  if (mc && BASE_CURRENCY && mc !== BASE_CURRENCY && mcVal !== null && mcVal !== undefined && mcVal !== '') {
    return formatMoney(mcVal, mc)
  }
  return formatMoney(record[field], BASE_CURRENCY || mc)
}

// Same idea for a line item within a document.
export function lineMoney(line, record, field) {
  const mc = record && record.multicurrency_code
  const mcVal = line['multicurrency_' + field]
  if (mc && BASE_CURRENCY && mc !== BASE_CURRENCY && mcVal !== null && mcVal !== undefined && mcVal !== '') {
    return formatMoney(mcVal, mc)
  }
  return formatMoney(line[field], BASE_CURRENCY || mc)
}

export function formatMoney(v, currency) {
  const n = toNumber(v)
  if (n === null) return '—'
  const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, ...opts }).format(n)
    } catch {
      /* fall through to plain */
    }
  }
  return new Intl.NumberFormat(undefined, opts).format(n)
}

export function formatNumber(v) {
  const n = toNumber(v)
  if (n === null) return '—'
  return new Intl.NumberFormat().format(n)
}

// Dolibarr dates: unix seconds (e.g. "1719273600"), unix ms, or ISO.
// Returns a Date object, or null if unparseable.
export function toDate(v) {
  if (v === null || v === undefined || v === '') return null
  let d
  const n = toNumber(v)
  if (n !== null && /^\d+$/.test(String(v).trim())) {
    // Heuristic: 10-digit values are seconds, 13-digit are ms.
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

export function relativeDate(v) {
  const abs = formatDate(v)
  return abs
}

// Whether a Dolibarr date value falls within a named range (for list filters).
export function dateInRange(v, range) {
  if (!range || range === 'all') return true
  const d = toDate(v)
  if (!d) return false
  const now = new Date()
  const start = new Date(now)
  if (range === 'today') start.setHours(0, 0, 0, 0)
  else if (range === 'week') {
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
  } else if (range === 'month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  } else return true
  return d.getTime() >= start.getTime()
}

// Dolibarr custom fields (extrafields) live in `array_options` with keys like
// "options_mycode". Returns [{ key, label, value }] of the non-empty ones.
export function extraFields(record) {
  const ao = record && record.array_options
  if (!ao || typeof ao !== 'object' || Array.isArray(ao)) return []
  return Object.entries(ao)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .map(([k, v]) => ({ key: k, label: humanizeKey(k.replace(/^options_/, '')), value: v }))
}

// Title-cases a snake_case / camelCase field key for the detail view.
export function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
