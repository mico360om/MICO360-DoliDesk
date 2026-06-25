// Build the Dolibarr web-UI URL for a record so the user can open it in their
// browser. The base is the profile's URL with the API entry point stripped.

const PATHS = {
  invoices: (id) => `/compta/facture/card.php?id=${id}`,
  orders: (id) => `/commande/card.php?id=${id}`,
  proposals: (id) => `/comm/propal/card.php?id=${id}`,
  thirdparties: (id) => `/societe/card.php?socid=${id}`,
  products: (id) => `/product/card.php?id=${id}`,
  supplierorders: (id) => `/fourn/commande/card.php?id=${id}`,
  supplierinvoices: (id) => `/fourn/facture/card.php?id=${id}`,
}

export function dolibarrWebUrl(baseUrl, type, id) {
  if (!baseUrl || !PATHS[type] || id == null) return null
  const base = String(baseUrl).trim().replace(/\/+$/, '').replace(/\/api\/index\.php$/i, '')
  return base + PATHS[type](id)
}
