import { describe, expect, it } from 'vitest'
import { dolibarrWebUrl } from './dolibarrUrl.js'

describe('dolibarrWebUrl', () => {
  it('strips the API entry point and builds a card URL', () => {
    expect(dolibarrWebUrl('https://erp.example.com/api/index.php', 'invoices', 7))
      .toBe('https://erp.example.com/compta/facture/card.php?id=7')
  })
  it('uses socid for third parties', () => {
    expect(dolibarrWebUrl('https://erp.example.com', 'thirdparties', 12))
      .toBe('https://erp.example.com/societe/card.php?socid=12')
  })
  it('trims trailing slashes', () => {
    expect(dolibarrWebUrl('https://erp.example.com///', 'orders', 3))
      .toBe('https://erp.example.com/commande/card.php?id=3')
  })
  it('covers every supported type', () => {
    expect(dolibarrWebUrl('http://h', 'proposals', 1)).toContain('/comm/propal/card.php?id=1')
    expect(dolibarrWebUrl('http://h', 'products', 1)).toContain('/product/card.php?id=1')
    expect(dolibarrWebUrl('http://h', 'supplierorders', 1)).toContain('/fourn/commande/card.php?id=1')
    expect(dolibarrWebUrl('http://h', 'supplierinvoices', 1)).toContain('/fourn/facture/card.php?id=1')
  })
  it('returns null for missing inputs or unknown type', () => {
    expect(dolibarrWebUrl('', 'invoices', 1)).toBeNull()
    expect(dolibarrWebUrl('http://h', 'unknown', 1)).toBeNull()
    expect(dolibarrWebUrl('http://h', 'invoices', null)).toBeNull()
    expect(dolibarrWebUrl('http://h', 'invoices', undefined)).toBeNull()
  })
})
