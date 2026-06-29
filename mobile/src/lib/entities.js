import { formatDate, formatNumber, recordMoney } from './format.js'

// Record types mirrored from the desktop app. render() functions return plain
// strings (rendered inside <Text> on mobile).

const pickId = (r) => r.id ?? r.rowid ?? r.ref ?? null

function thirdpartyStatus(r) {
  return Number(r.status) === 1 ? { label: 'Active', tone: 'green' } : { label: 'Inactive', tone: 'slate' }
}
function invoiceStatus(r) {
  const s = Number(r.status ?? r.statut)
  if (s === 0) return { label: 'Draft', tone: 'slate' }
  if (s === 2 || Number(r.paye) === 1) return { label: 'Paid', tone: 'green' }
  if (s === 3) return { label: 'Abandoned', tone: 'red' }
  return { label: 'Unpaid', tone: 'amber' }
}
function orderStatus(r) {
  const map = { 0: ['Draft', 'slate'], 1: ['Validated', 'blue'], 2: ['In process', 'amber'], 3: ['Delivered', 'green'], '-1': ['Cancelled', 'red'] }
  const m = map[Number(r.status ?? r.statut)] || ['Unknown', 'slate']
  return { label: m[0], tone: m[1] }
}
function proposalStatus(r) {
  const map = { 0: ['Draft', 'slate'], 1: ['Open', 'blue'], 2: ['Signed', 'green'], 3: ['Not signed', 'red'], 4: ['Billed', 'green'] }
  const m = map[Number(r.status ?? r.statut)] || ['Unknown', 'slate']
  return { label: m[0], tone: m[1] }
}
function productStatus(r) {
  return Number(r.status) === 1 ? { label: 'On sale', tone: 'green' } : { label: 'Not for sale', tone: 'slate' }
}
function supplierOrderStatus(r) {
  const map = {
    0: ['Draft', 'slate'], 1: ['Validated', 'blue'], 2: ['Approved', 'blue'], 3: ['Ordered', 'amber'],
    4: ['Partially received', 'amber'], 5: ['Received', 'green'], 6: ['Cancelled', 'red'], 7: ['Cancelled', 'red'], 9: ['Refused', 'red'],
  }
  const m = map[Number(r.status ?? r.statut)] || ['Unknown', 'slate']
  return { label: m[0], tone: m[1] }
}
function supplierInvoiceStatus(r) {
  const s = Number(r.status ?? r.statut)
  if (s === 0) return { label: 'Draft', tone: 'slate' }
  if (s === 2 || Number(r.paye) === 1) return { label: 'Paid', tone: 'green' }
  if (s === 3) return { label: 'Abandoned', tone: 'red' }
  return { label: 'Unpaid', tone: 'amber' }
}

// Sort presets surfaced in the list UI. sortfield must be a real DB column.
const NEWEST = { key: 'newest', label: 'Newest', sortfield: 't.rowid', sortorder: 'DESC' }
const docSorts = (dateCol) => [
  NEWEST,
  { key: 'date_desc', label: 'Date ↓', sortfield: dateCol, sortorder: 'DESC' },
  { key: 'amount_desc', label: 'Amount ↓', sortfield: 't.total_ttc', sortorder: 'DESC' },
  { key: 'ref', label: 'Ref A–Z', sortfield: 't.ref', sortorder: 'ASC' },
]

export const ENTITIES = {
  thirdparties: {
    key: 'thirdparties', label: 'Third parties', singular: 'Third party', icon: '🏢',
    title: (r) => r.name || r.name_alias || `#${pickId(r)}`,
    subtitle: (r) => [r.town, r.country_code].filter(Boolean).join(', '),
    status: thirdpartyStatus,
    searchFields: ['name', 'name_alias', 'email', 'town', 'code_client', 'phone'],
    sqlSearch: ['t.nom', 't.name_alias', 't.email', 't.town', 't.code_client'],
    sortOptions: [NEWEST, { key: 'name', label: 'Name A–Z', sortfield: 't.nom', sortorder: 'ASC' }],
    columns: [
      { key: 'town', label: 'Town', render: (r) => r.town || '—' },
      { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    ],
    detailFields: ['name', 'name_alias', 'code_client', 'email', 'phone', 'address', 'zip', 'town', 'country_code', 'url', 'tva_intra'],
  },
  invoices: {
    key: 'invoices', label: 'Invoices', singular: 'Invoice', icon: '🧾', dateField: 'date',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date),
    status: invoiceStatus,
    amount: (r) => recordMoney(r, 'total_ttc'),
    socField: 'socid',
    searchFields: ['ref', 'ref_client'],
    sqlSearch: ['t.ref', 't.ref_client'],
    sortOptions: docSorts('t.date'),
    columns: [
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
      { key: 'total_ttc', label: 'Total', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_client', 'date', 'date_lim_reglement', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },
  products: {
    key: 'products', label: 'Products', singular: 'Product', icon: '📦',
    title: (r) => r.label || r.ref || `#${pickId(r)}`,
    subtitle: (r) => r.ref || '',
    status: productStatus,
    searchFields: ['ref', 'label', 'barcode'],
    sqlSearch: ['t.ref', 't.label', 't.barcode'],
    sortOptions: [NEWEST, { key: 'label', label: 'Name A–Z', sortfield: 't.label', sortorder: 'ASC' }, { key: 'ref', label: 'Ref A–Z', sortfield: 't.ref', sortorder: 'ASC' }],
    columns: [
      { key: 'price', label: 'Price', render: (r) => recordMoney(r, 'price') },
      { key: 'stock', label: 'Stock', render: (r) => (r.stock_reel != null ? formatNumber(r.stock_reel) : '—') },
    ],
    detailFields: ['ref', 'label', 'description', 'price', 'price_ttc', 'tva_tx', 'stock_reel', 'barcode', 'weight'],
  },
  orders: {
    key: 'orders', label: 'Orders', singular: 'Order', icon: '📑', dateField: 'date_commande',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date_commande || r.date),
    status: orderStatus,
    amount: (r) => recordMoney(r, 'total_ttc'),
    socField: 'socid',
    searchFields: ['ref', 'ref_client'],
    sqlSearch: ['t.ref', 't.ref_client'],
    sortOptions: docSorts('t.date_commande'),
    columns: [
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date_commande || r.date) },
      { key: 'total_ttc', label: 'Total', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_client', 'date_commande', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },
  proposals: {
    key: 'proposals', label: 'Proposals', singular: 'Proposal', icon: '📝', dateField: 'date',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date),
    status: proposalStatus,
    amount: (r) => recordMoney(r, 'total_ttc'),
    socField: 'socid',
    searchFields: ['ref', 'ref_client'],
    sqlSearch: ['t.ref', 't.ref_client'],
    sortOptions: docSorts('t.date'),
    columns: [
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
      { key: 'total_ttc', label: 'Total', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_client', 'date', 'fin_validite', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },
  supplierorders: {
    key: 'supplierorders', label: 'Supplier orders', singular: 'Supplier order', icon: '🚚', dateField: 'date_commande',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => [r.ref_supplier, formatDate(r.date_commande || r.date)].filter(Boolean).join(' · '),
    status: supplierOrderStatus,
    amount: (r) => recordMoney(r, 'total_ttc'),
    socField: 'socid',
    searchFields: ['ref', 'ref_supplier'],
    sqlSearch: ['t.ref', 't.ref_supplier'],
    sortOptions: docSorts('t.date_commande'),
    columns: [
      { key: 'ref_supplier', label: 'Supplier ref', render: (r) => r.ref_supplier || '—' },
      { key: 'total_ttc', label: 'Total', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_supplier', 'date_commande', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },
  supplierinvoices: {
    key: 'supplierinvoices', label: 'Supplier invoices', singular: 'Supplier invoice', icon: '🧾', dateField: 'datef',
    title: (r) => r.ref || r.ref_supplier || `#${pickId(r)}`,
    subtitle: (r) => [r.ref_supplier, formatDate(r.datef || r.date)].filter(Boolean).join(' · '),
    status: supplierInvoiceStatus,
    amount: (r) => recordMoney(r, 'total_ttc'),
    socField: 'socid',
    searchFields: ['ref', 'ref_supplier'],
    sqlSearch: ['t.ref', 't.ref_supplier'],
    sortOptions: docSorts('t.datef'),
    columns: [
      { key: 'ref_supplier', label: 'Supplier ref', render: (r) => r.ref_supplier || '—' },
      { key: 'total_ttc', label: 'Total', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_supplier', 'datef', 'date_lim_reglement', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },
}

export const ENTITY_LIST = Object.values(ENTITIES)
export const recordId = pickId
export function getEntity(type) {
  return ENTITIES[type] || null
}

// Build a Dolibarr `sqlfilters` expression searching `term` across the entity's
// configured DB columns, e.g. (t.ref:like:'%abc%') or (t.label:like:'%abc%').
export function buildSqlSearch(entity, term) {
  const t = (term || '').trim()
  if (!t || !entity?.sqlSearch?.length) return undefined
  const safe = t.replace(/['\\%]/g, '') // strip chars that could break the filter
  if (!safe) return undefined
  return entity.sqlSearch.map((col) => `(${col}:like:'%${safe}%')`).join(' or ')
}
