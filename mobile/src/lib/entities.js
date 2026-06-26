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

export const ENTITIES = {
  thirdparties: {
    key: 'thirdparties', label: 'Third parties', singular: 'Third party', icon: '🏢',
    title: (r) => r.name || r.name_alias || `#${pickId(r)}`,
    subtitle: (r) => [r.town, r.country_code].filter(Boolean).join(', '),
    status: thirdpartyStatus,
    searchFields: ['name', 'name_alias', 'email', 'town', 'code_client', 'phone'],
    columns: [
      { key: 'town', label: 'Town', render: (r) => r.town || '—' },
      { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    ],
    detailFields: ['name', 'name_alias', 'code_client', 'email', 'phone', 'address', 'zip', 'town', 'country_code', 'url', 'tva_intra'],
  },
  invoices: {
    key: 'invoices', label: 'Invoices', singular: 'Invoice', icon: '🧾',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date),
    status: invoiceStatus,
    amount: (r) => recordMoney(r, 'total_ttc'),
    searchFields: ['ref', 'ref_client'],
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
    columns: [
      { key: 'price', label: 'Price', render: (r) => recordMoney(r, 'price') },
      { key: 'stock', label: 'Stock', render: (r) => (r.stock_reel != null ? formatNumber(r.stock_reel) : '—') },
    ],
    detailFields: ['ref', 'label', 'description', 'price', 'price_ttc', 'tva_tx', 'stock_reel', 'barcode', 'weight'],
  },
  orders: {
    key: 'orders', label: 'Orders', singular: 'Order', icon: '📑',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date_commande || r.date),
    status: orderStatus,
    amount: (r) => recordMoney(r, 'total_ttc'),
    searchFields: ['ref', 'ref_client'],
    columns: [
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date_commande || r.date) },
      { key: 'total_ttc', label: 'Total', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_client', 'date_commande', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },
  proposals: {
    key: 'proposals', label: 'Proposals', singular: 'Proposal', icon: '📝',
    title: (r) => r.ref || `#${pickId(r)}`,
    subtitle: (r) => formatDate(r.date),
    status: proposalStatus,
    amount: (r) => recordMoney(r, 'total_ttc'),
    searchFields: ['ref', 'ref_client'],
    columns: [
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
      { key: 'total_ttc', label: 'Total', render: (r) => recordMoney(r, 'total_ttc') },
    ],
    detailFields: ['ref', 'ref_client', 'date', 'fin_validite', 'total_ht', 'total_tva', 'total_ttc', 'multicurrency_code'],
  },
}

export const ENTITY_LIST = Object.values(ENTITIES)
export const recordId = pickId
export function getEntity(type) {
  return ENTITIES[type] || null
}
