import { formatMoney, formatDate, formatNumber, toNumber, toDate, recordMoney, getBaseCurrency } from './format.js'

// Single source of truth for every supported Dolibarr record type. The
// list page, detail page and dashboard are all generic and read from here,
// so adding a new entity is a matter of adding one config object.

const statusTone = (tone) => tone // 'green' | 'amber' | 'red' | 'slate' | 'blue'

function pickId(r) {
  return r.id ?? r.rowid ?? r.ref ?? null
}

// ---- Status decoders (Dolibarr stores numeric codes) ----------------------

function thirdpartyStatus(r) {
  return Number(r.status) === 1
    ? { label: 'Active', tone: 'green' }
    : { label: 'Inactive', tone: 'slate' }
}

function thirdpartyRole(r) {
  const client = Number(r.client)
  const supplier = Number(r.fournisseur)
  const roles = []
  if (client === 1 || client === 3) roles.push('Customer')
  if (client === 2 || client === 3) roles.push('Prospect')
  if (supplier === 1) roles.push('Supplier')
  return roles.join(' · ') || '—'
}

function invoiceStatus(r) {
  const s = Number(r.status ?? r.statut)
  const paid = Number(r.paye) === 1
  if (s === 0) return { label: 'Draft', tone: 'slate' }
  if (s === 2 || paid) return { label: 'Paid', tone: 'green' }
  if (s === 3) return { label: 'Abandoned', tone: 'red' }
  return { label: 'Unpaid', tone: 'amber' }
}

function orderStatus(r) {
  const s = Number(r.status ?? r.statut)
  const map = {
    0: { label: 'Draft', tone: 'slate' },
    1: { label: 'Validated', tone: 'blue' },
    2: { label: 'In process', tone: 'amber' },
    3: { label: 'Delivered', tone: 'green' },
    '-1': { label: 'Cancelled', tone: 'red' },
  }
  return map[s] || { label: 'Unknown', tone: 'slate' }
}

function proposalStatus(r) {
  const s = Number(r.status ?? r.statut)
  const map = {
    0: { label: 'Draft', tone: 'slate' },
    1: { label: 'Open', tone: 'blue' },
    2: { label: 'Signed', tone: 'green' },
    3: { label: 'Not signed', tone: 'red' },
    4: { label: 'Billed', tone: 'green' },
  }
  return map[s] || { label: 'Unknown', tone: 'slate' }
}

function productStatus(r) {
  return Number(r.status) === 1
    ? { label: 'On sale', tone: 'green' }
    : { label: 'Not for sale', tone: 'slate' }
}

function isUnpaidInvoice(r) {
  return invoiceStatus(r).label === 'Unpaid'
}

function supplierOrderStatus(r) {
  const s = Number(r.status ?? r.statut)
  const map = {
    0: { label: 'Draft', tone: 'slate' },
    1: { label: 'Validated', tone: 'blue' },
    2: { label: 'Approved', tone: 'blue' },
    3: { label: 'Ordered', tone: 'amber' },
    4: { label: 'Partially received', tone: 'amber' },
    5: { label: 'Received', tone: 'green' },
    6: { label: 'Cancelled', tone: 'red' },
    7: { label: 'Cancelled', tone: 'red' },
    9: { label: 'Refused', tone: 'red' },
  }
  return map[s] || { label: 'Unknown', tone: 'slate' }
}

function supplierInvoiceStatus(r) {
  const s = Number(r.status ?? r.statut)
  if (s === 0) return { label: 'Draft', tone: 'slate' }
  if (s === 2 || Number(r.paye) === 1) return { label: 'Paid', tone: 'green' }
  if (s === 3) return { label: 'Abandoned', tone: 'red' }
  return { label: 'Unpaid', tone: 'amber' }
}

// Builds the summary metrics shown above a list — including a "Today" figure
// (records dated today) plus running totals over the supplied rows.
function moneySummary(rows, { dateField, ttc = 'total_ttc', ht = 'total_ht', unpaid } = {}) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const isToday = (r) => {
    const d = toDate(r[dateField])
    return d && d.getTime() >= start.getTime()
  }
  const sum = (rs, f) => rs.reduce((s, r) => s + (toNumber(r[f]) || 0), 0)
  const todays = dateField ? rows.filter(isToday) : []
  // Aggregates use base-currency totals (normalised across documents) and are
  // labelled with the company's base currency.
  const cur = getBaseCurrency()

  const metrics = []
  if (dateField) {
    metrics.push({
      label: 'Today',
      value: formatMoney(sum(todays, ttc), cur),
      sub: `${todays.length} record${todays.length === 1 ? '' : 's'}`,
      accent: 'brand',
    })
  }
  metrics.push({ label: 'Records', value: String(rows.length), accent: 'slate' })
  metrics.push({ label: 'Total (excl. tax)', value: formatMoney(sum(rows, ht), cur), accent: 'slate' })
  metrics.push({ label: 'Total (incl. tax)', value: formatMoney(sum(rows, ttc), cur), accent: 'emerald' })
  if (unpaid) {
    const out = rows.filter(unpaid)
    metrics.push({
      label: 'Outstanding',
      value: formatMoney(sum(out, ttc), cur),
      sub: `${out.length} unpaid`,
      accent: 'amber',
    })
  }
  return metrics
}

function productSummary(rows) {
  const n = (r, f) => toNumber(r[f]) || 0
  const onSale = rows.filter((r) => Number(r.status) === 1).length
  const stock = rows.reduce((s, r) => s + n(r, 'stock_reel'), 0)
  const value = rows.reduce((s, r) => s + n(r, 'stock_reel') * n(r, 'price'), 0)
  return [
    { label: 'Products', value: String(rows.length), accent: 'slate' },
    { label: 'On sale', value: String(onSale), accent: 'emerald' },
    { label: 'Total stock', value: formatNumber(stock), accent: 'slate' },
    { label: 'Stock value', value: formatMoney(value, getBaseCurrency()), accent: 'brand' },
  ]
}

function thirdpartySummary(rows) {
  const customers = rows.filter((r) => [1, 3].includes(Number(r.client))).length
  const suppliers = rows.filter((r) => Number(r.fournisseur) === 1).length
  const active = rows.filter((r) => Number(r.status) === 1).length
  return [
    { label: 'Third parties', value: String(rows.length), accent: 'slate' },
    { label: 'Customers', value: String(customers), accent: 'brand' },
    { label: 'Suppliers', value: String(suppliers), accent: 'amber' },
    { label: 'Active', value: String(active), accent: 'emerald' },
  ]
}

// ---- Entity registry -------------------------------------------------------

export const ENTITIES = {
  thirdparties: {
    key: 'thirdparties',
    label: 'Third parties',
    singular: 'Third party',
    icon: '🏢',
    sortfield: 't.rowid',
    title: (r) => r.name || r.name_alias || `#${pickId(r)}`,
    subtitle: (r) => [r.town, r.country_code].filter(Boolean).join(', '),
    status: thirdpartyStatus,
    summary: (rows) => thirdpartySummary(rows),
    // Fields scanned by the in-app (client-side) search box.
    searchFields: ['name', 'name_alias', 'email', 'town', 'code_client', 'phone'],
    // DB columns used for server-side sqlfilters search (whole dataset).
    sqlSearch: ['t.nom', 't.name_alias', 't.email', 't.town', 't.code_client'],
    columns: [
      { key: 'name', label: 'Name', grow: true, render: (r) => r.name || r.name_alias || '—' },
      { key: 'role', label: 'Role', render: (r) => thirdpartyRole(r) },
      { key: 'town', label: 'Town', render: (r) => r.town || '—' },
      { key: 'email', label: 'Email', render: (r) => r.email || '—' },
      { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    ],
    detailFields: [
      'name', 'name_alias', 'code_client', 'code_fournisseur', 'email', 'phone',
      'address', 'zip', 'town', 'country_code', 'url', 'tva_intra',
    ],
  },

  invoices: {
    key: 'invoices',
    label: 'Invoices',
    singular: 'Invoice',
    icon: '🧾',
    sortfield: 't.rowid',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date),
    status: invoiceStatus,
    searchFields: ['ref', 'ref_client', 'socid'],
    sqlSearch: ['t.ref', 't.ref_client'],
    socField: 'socid', // links to a third party — resolved to a name in the UI
    hasLines: true,
    amountField: 'total_ttc',
    dateField: 'date',
    summary: (rows) => moneySummary(rows, { dateField: 'date', unpaid: isUnpaidInvoice }),
    columns: [
      { key: 'ref', label: 'Reference', grow: true, render: (r) => r.ref || '—' },
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
      { key: 'date_lim_reglement', label: 'Due date', render: (r) => formatDate(r.date_lim_reglement) },
      { key: 'total_ht', label: 'Total (excl.)', align: 'right', render: (r) => recordMoney(r, 'total_ht') },
      { key: 'total_tva', label: 'VAT', align: 'right', render: (r) => recordMoney(r, 'total_tva') },
      { key: 'total_ttc', label: 'Total (incl.)', align: 'right', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_client', 'date', 'date_lim_reglement', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },

  products: {
    key: 'products',
    label: 'Products',
    singular: 'Product',
    icon: '📦',
    sortfield: 't.rowid',
    title: (r) => r.label || r.ref || `#${pickId(r)}`,
    subtitle: (r) => r.ref || '',
    status: productStatus,
    summary: (rows) => productSummary(rows),
    searchFields: ['ref', 'label', 'barcode'],
    sqlSearch: ['t.ref', 't.label', 't.barcode'],
    amountField: 'price_ttc',
    columns: [
      { key: 'ref', label: 'Ref', render: (r) => r.ref || '—' },
      { key: 'label', label: 'Label', grow: true, render: (r) => r.label || '—' },
      { key: 'type', label: 'Type', render: (r) => (Number(r.type) === 1 ? 'Service' : 'Product') },
      { key: 'price', label: 'Price (excl.)', align: 'right', render: (r) => formatMoney(r.price, getBaseCurrency()) },
      { key: 'stock', label: 'Stock', align: 'right', render: (r) => (r.stock_reel != null ? formatNumber(r.stock_reel) : '—') },
    ],
    detailFields: ['ref', 'label', 'description', 'type', 'price', 'price_ttc', 'tva_tx', 'stock_reel', 'barcode', 'weight'],
  },

  orders: {
    key: 'orders',
    label: 'Orders',
    singular: 'Order',
    icon: '📑',
    sortfield: 't.rowid',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date_commande || r.date),
    status: orderStatus,
    searchFields: ['ref', 'ref_client', 'socid'],
    sqlSearch: ['t.ref', 't.ref_client'],
    socField: 'socid',
    hasLines: true,
    amountField: 'total_ttc',
    dateField: 'date_commande',
    summary: (rows) => moneySummary(rows, { dateField: 'date_commande' }),
    columns: [
      { key: 'ref', label: 'Reference', grow: true, render: (r) => r.ref || '—' },
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date_commande || r.date) },
      { key: 'total_ht', label: 'Total (excl.)', align: 'right', render: (r) => recordMoney(r, 'total_ht') },
      { key: 'total_ttc', label: 'Total (incl.)', align: 'right', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_client', 'date_commande', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },

  proposals: {
    key: 'proposals',
    label: 'Proposals',
    singular: 'Proposal',
    icon: '📝',
    sortfield: 't.rowid',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date),
    status: proposalStatus,
    searchFields: ['ref', 'ref_client', 'socid'],
    sqlSearch: ['t.ref', 't.ref_client'],
    socField: 'socid',
    hasLines: true,
    amountField: 'total_ttc',
    dateField: 'date',
    summary: (rows) => moneySummary(rows, { dateField: 'date' }),
    columns: [
      { key: 'ref', label: 'Reference', grow: true, render: (r) => r.ref || '—' },
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
      { key: 'total_ht', label: 'Total (excl.)', align: 'right', render: (r) => recordMoney(r, 'total_ht') },
      { key: 'total_ttc', label: 'Total (incl.)', align: 'right', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_client', 'date', 'fin_validite', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },

  // ---- Supplier / purchasing (shown when the modules are enabled) ----
  supplierorders: {
    key: 'supplierorders',
    label: 'Supplier orders',
    singular: 'Supplier order',
    icon: '🚚',
    sortfield: 't.rowid',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => [r.ref_supplier, formatDate(r.date_commande || r.date)].filter(Boolean).join(' · '),
    status: supplierOrderStatus,
    socField: 'socid',
    hasLines: true,
    dateField: 'date_commande',
    searchFields: ['ref', 'ref_supplier', 'socid'],
    sqlSearch: ['t.ref', 't.ref_supplier'],
    summary: (rows) => moneySummary(rows, { dateField: 'date_commande' }),
    columns: [
      { key: 'ref', label: 'Reference', grow: true, render: (r) => r.ref || '—' },
      { key: 'ref_supplier', label: 'Supplier ref', render: (r) => r.ref_supplier || '—' },
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date_commande || r.date) },
      { key: 'total_ht', label: 'Total (excl.)', align: 'right', render: (r) => recordMoney(r, 'total_ht') },
      { key: 'total_ttc', label: 'Total (incl.)', align: 'right', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_supplier', 'date_commande', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },

  supplierinvoices: {
    key: 'supplierinvoices',
    label: 'Supplier invoices',
    singular: 'Supplier invoice',
    icon: '🧾',
    sortfield: 't.rowid',
    title: (r) => r.ref || r.ref_supplier || `#${pickId(r)}`,
    subtitle: (r) => [r.ref_supplier, formatDate(r.datef || r.date)].filter(Boolean).join(' · '),
    status: supplierInvoiceStatus,
    socField: 'socid',
    hasLines: true,
    dateField: 'datef',
    searchFields: ['ref', 'ref_supplier', 'socid'],
    sqlSearch: ['t.ref', 't.ref_supplier'],
    summary: (rows) => moneySummary(rows, { dateField: 'datef', unpaid: (r) => supplierInvoiceStatus(r).label === 'Unpaid' }),
    columns: [
      { key: 'ref', label: 'Reference', grow: true, render: (r) => r.ref || '—' },
      { key: 'ref_supplier', label: 'Supplier ref', render: (r) => r.ref_supplier || '—' },
      { key: 'date', label: 'Date', render: (r) => formatDate(r.datef || r.date) },
      { key: 'total_ht', label: 'Total (excl.)', align: 'right', render: (r) => recordMoney(r, 'total_ht') },
      { key: 'total_ttc', label: 'Total (incl.)', align: 'right', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_supplier', 'datef', 'date_lim_reglement', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },
}

// Core record types shown for every Dolibarr instance.
const CORE_KEYS = ['thirdparties', 'invoices', 'products', 'orders', 'proposals']
// Optional types shown only when their module is detected as enabled.
export const OPTIONAL_ENTITY_KEYS = ['supplierorders', 'supplierinvoices']

export const ENTITY_LIST = CORE_KEYS.map((k) => ENTITIES[k])
export const OPTIONAL_ENTITIES = OPTIONAL_ENTITY_KEYS.map((k) => ENTITIES[k])

export function getEntity(type) {
  return ENTITIES[type] || null
}

export function recordId(r) {
  return pickId(r)
}

// Build a Dolibarr `sqlfilters` expression that searches `term` across the
// entity's configured DB columns, e.g. (t.ref:like:'%abc%') or (t.label:like:'%abc%').
export function buildSqlSearch(entity, term) {
  const t = (term || '').trim()
  if (!t || !entity.sqlSearch?.length) return undefined
  const safe = t.replace(/['\\%]/g, '') // strip chars that could break the filter
  if (!safe) return undefined
  return entity.sqlSearch.map((col) => `(${col}:like:'%${safe}%')`).join(' or ')
}

export { thirdpartyRole }
