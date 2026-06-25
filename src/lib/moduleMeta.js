import { humanizeKey } from './format.js'

// Friendly label + icon for Dolibarr API modules (used to build the dynamic,
// instance-driven navigation). Unknown modules fall back to a humanized name.
const META = {
  thirdparties: { label: 'Third parties', icon: '🏢' },
  contacts: { label: 'Contacts', icon: '👤' },
  invoices: { label: 'Invoices', icon: '🧾' },
  supplierinvoices: { label: 'Supplier invoices', icon: '🧾' },
  invoicestemplates: { label: 'Recurring invoices', icon: '🔁' },
  orders: { label: 'Orders', icon: '📑' },
  supplierorders: { label: 'Supplier orders', icon: '🚚' },
  proposals: { label: 'Proposals', icon: '📝' },
  supplierproposals: { label: 'Supplier proposals', icon: '📝' },
  products: { label: 'Products', icon: '📦' },
  warehouses: { label: 'Warehouses', icon: '🏬' },
  stockmovements: { label: 'Stock movements', icon: '📊' },
  projects: { label: 'Projects', icon: '📁' },
  tasks: { label: 'Tasks', icon: '✅' },
  contracts: { label: 'Contracts', icon: '📜' },
  tickets: { label: 'Tickets', icon: '🎫' },
  interventions: { label: 'Interventions', icon: '🛠️' },
  shipments: { label: 'Shipments', icon: '🚢' },
  receptions: { label: 'Receptions', icon: '📥' },
  expensereports: { label: 'Expense reports', icon: '💸' },
  members: { label: 'Members', icon: '👥' },
  memberstypes: { label: 'Member types', icon: '🏷️' },
  subscriptions: { label: 'Subscriptions', icon: '🔖' },
  bankaccounts: { label: 'Bank accounts', icon: '🏦' },
  categories: { label: 'Categories', icon: '🏷️' },
  agendaevents: { label: 'Events', icon: '📅' },
  users: { label: 'Users', icon: '🧑' },
  usergroups: { label: 'User groups', icon: '👥' },
  knowledgemanagement: { label: 'Knowledge base', icon: '📚' },
  recruitments: { label: 'Recruitment', icon: '🧑‍💼' },
  partnerships: { label: 'Partnerships', icon: '🤝' },
  donations: { label: 'Donations', icon: '🎁' },
  multicurrencies: { label: 'Currencies', icon: '💱' },
  mos: { label: 'Manufacturing orders', icon: '🏭' },
  boms: { label: 'Bills of materials', icon: '🧱' },
  mico360statements: { label: 'Client Statements', icon: '📑' },
}

// API tags that aren't browsable record collections — hidden from nav.
export const NON_BROWSABLE = new Set([
  'login', 'status', 'setup', 'documents', 'tools', 'boxes', 'api', 'dictionary',
])

export function getModuleMeta(key) {
  return META[key] || { label: humanizeKey(key), icon: '📋' }
}
