import { humanizeKey } from './format.js'

// Friendly label + icon for Dolibarr API modules, and the section each belongs
// to (for grouped navigation). Unknown modules fall back to a humanized name.
const META = {
  thirdparties: { label: 'Third parties', icon: '🏢' },
  contacts: { label: 'Contacts', icon: '👤' },
  categories: { label: 'Categories', icon: '🏷️' },
  partnerships: { label: 'Partnerships', icon: '🤝' },

  invoices: { label: 'Invoices', icon: '🧾' },
  invoicestemplates: { label: 'Recurring invoices', icon: '🔁' },
  orders: { label: 'Orders', icon: '📑' },
  proposals: { label: 'Proposals', icon: '📝' },
  contracts: { label: 'Contracts', icon: '📜' },
  tickets: { label: 'Tickets', icon: '🎫' },
  interventions: { label: 'Interventions', icon: '🛠️' },
  shipments: { label: 'Shipments', icon: '🚢' },
  mico360deliverynoteapi: { label: 'Delivery Notes', icon: '🚚' },
  deliverynotes: { label: 'Delivery Notes', icon: '🚚' },

  supplierproposals: { label: 'Supplier proposals', icon: '📝' },
  supplierorders: { label: 'Supplier orders', icon: '🚚' },
  supplierinvoices: { label: 'Supplier invoices', icon: '🧾' },
  receptions: { label: 'Receptions', icon: '📥' },

  bankaccounts: { label: 'Bank Accounts', icon: '🏦' },
  paiements: { label: 'Payments', icon: '💳' },
  payments: { label: 'Payments', icon: '💳' },
  multicurrencies: { label: 'Currencies', icon: '💱' },
  donations: { label: 'Donations', icon: '🎁' },
  expensereports: { label: 'Expense reports', icon: '💸' },

  products: { label: 'Products', icon: '📦' },
  productlots: { label: 'Product Lots', icon: '🏷️' },
  warehouses: { label: 'Warehouses', icon: '🏬' },
  stockmovements: { label: 'Stock movements', icon: '📊' },
  boms: { label: 'Bills of materials', icon: '🧱' },
  mos: { label: 'Manufacturing orders', icon: '🏭' },

  projects: { label: 'Projects', icon: '📁' },
  tasks: { label: 'Tasks', icon: '✅' },

  members: { label: 'Members', icon: '👥' },
  memberstypes: { label: 'Member types', icon: '🏷️' },
  subscriptions: { label: 'Subscriptions', icon: '🔖' },
  users: { label: 'Users', icon: '🧑' },
  usergroups: { label: 'User groups', icon: '👥' },
  recruitments: { label: 'Recruitment', icon: '🧑‍💼' },
  holidays: { label: 'Leave requests', icon: '🌴' },
  agendaevents: { label: 'Events', icon: '📅' },

  emailtemplates: { label: 'Email Templates', icon: '✉️' },
  knowledgemanagement: { label: 'Knowledge base', icon: '📚' },
  mico360statements: { label: 'Client Statements', icon: '📑' },
}

// API tags that aren't browsable record collections — hidden from nav.
export const NON_BROWSABLE = new Set([
  'login', 'status', 'setup', 'documents', 'tools', 'boxes', 'api', 'dictionary',
])

// Module → section, for grouped navigation.
const GROUP = {
  thirdparties: 'CRM', contacts: 'CRM', categories: 'CRM', partnerships: 'CRM',
  proposals: 'Sales', orders: 'Sales', invoices: 'Sales', contracts: 'Sales', tickets: 'Sales',
  mico360deliverynoteapi: 'Sales', deliverynotes: 'Sales', shipments: 'Sales', interventions: 'Sales',
  supplierproposals: 'Purchases', supplierorders: 'Purchases', supplierinvoices: 'Purchases', receptions: 'Purchases',
  bankaccounts: 'Finance', paiements: 'Finance', payments: 'Finance', multicurrencies: 'Finance',
  donations: 'Finance', expensereports: 'Finance',
  products: 'Products & Stock', productlots: 'Products & Stock', warehouses: 'Products & Stock',
  stockmovements: 'Products & Stock', boms: 'Products & Stock', mos: 'Products & Stock',
  projects: 'Projects', tasks: 'Projects',
  members: 'HR', memberstypes: 'HR', subscriptions: 'HR', users: 'HR', usergroups: 'HR',
  recruitments: 'HR', holidays: 'HR', agendaevents: 'HR',
  emailtemplates: 'System', knowledgemanagement: 'System',
}

export const SECTIONS = ['CRM', 'Sales', 'Purchases', 'Finance', 'Products & Stock', 'Projects', 'HR', 'System', 'Other']

export function getModuleMeta(key) {
  return META[key] || { label: humanizeKey(key), icon: '📋' }
}

export function getModuleGroup(key) {
  return GROUP[key] || 'Other'
}
