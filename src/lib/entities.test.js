import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ENTITIES, ENTITY_LIST, OPTIONAL_ENTITIES, getEntity, recordId,
  buildSqlSearch, thirdpartyRole,
} from './entities.js'
import { setBaseCurrency } from './format.js'

afterEach(() => {
  setBaseCurrency(null)
  vi.useRealTimers()
})

describe('entity registry', () => {
  it('exposes the five core entities in order', () => {
    expect(ENTITY_LIST.map((e) => e.key)).toEqual([
      'thirdparties', 'invoices', 'products', 'orders', 'proposals',
    ])
  })
  it('exposes the optional supplier entities', () => {
    expect(OPTIONAL_ENTITIES.map((e) => e.key)).toEqual(['supplierorders', 'supplierinvoices'])
  })
  it('getEntity returns config or null', () => {
    expect(getEntity('invoices').label).toBe('Invoices')
    expect(getEntity('nope')).toBeNull()
  })
})

describe('recordId', () => {
  it('prefers id, then rowid, then ref', () => {
    expect(recordId({ id: 5, rowid: 9 })).toBe(5)
    expect(recordId({ rowid: 9 })).toBe(9)
    expect(recordId({ ref: 'FA-1' })).toBe('FA-1')
    expect(recordId({})).toBeNull()
  })
})

describe('invoiceStatus', () => {
  const status = ENTITIES.invoices.status
  it('draft / paid / unpaid / abandoned', () => {
    expect(status({ status: 0 }).label).toBe('Draft')
    expect(status({ status: 1, paye: 1 }).label).toBe('Paid')
    expect(status({ status: 2 }).label).toBe('Paid')
    expect(status({ status: 1, paye: 0 }).label).toBe('Unpaid')
    expect(status({ status: 3 }).label).toBe('Abandoned')
  })
  it('falls back to the statut alias', () => {
    expect(status({ statut: 0 }).label).toBe('Draft')
  })
})

describe('orderStatus', () => {
  const status = ENTITIES.orders.status
  it('maps known codes and tones', () => {
    expect(status({ status: 0 })).toEqual({ label: 'Draft', tone: 'slate' })
    expect(status({ status: 3 })).toEqual({ label: 'Delivered', tone: 'green' })
    expect(status({ status: -1 }).label).toBe('Cancelled')
    expect(status({ status: 99 }).label).toBe('Unknown')
  })
})

describe('proposalStatus', () => {
  const status = ENTITIES.proposals.status
  it('maps signed and not-signed', () => {
    expect(status({ status: 2 }).label).toBe('Signed')
    expect(status({ status: 3 }).label).toBe('Not signed')
    expect(status({ status: 4 }).label).toBe('Billed')
  })
})

describe('supplierOrderStatus / supplierInvoiceStatus', () => {
  it('supplier order received vs refused', () => {
    const s = ENTITIES.supplierorders.status
    expect(s({ status: 5 }).label).toBe('Received')
    expect(s({ status: 9 }).label).toBe('Refused')
  })
  it('supplier invoice paid by paye flag', () => {
    const s = ENTITIES.supplierinvoices.status
    expect(s({ status: 1, paye: 1 }).label).toBe('Paid')
    expect(s({ status: 1, paye: 0 }).label).toBe('Unpaid')
  })
})

describe('thirdpartyStatus / productStatus', () => {
  it('thirdparty active vs inactive', () => {
    expect(ENTITIES.thirdparties.status({ status: 1 }).label).toBe('Active')
    expect(ENTITIES.thirdparties.status({ status: 0 }).label).toBe('Inactive')
  })
  it('product on sale vs not', () => {
    expect(ENTITIES.products.status({ status: 1 }).label).toBe('On sale')
    expect(ENTITIES.products.status({ status: 0 }).label).toBe('Not for sale')
  })
})

describe('thirdpartyRole', () => {
  it('decodes client/supplier codes', () => {
    expect(thirdpartyRole({ client: 1, fournisseur: 0 })).toBe('Customer')
    expect(thirdpartyRole({ client: 2, fournisseur: 0 })).toBe('Prospect')
    expect(thirdpartyRole({ client: 3, fournisseur: 1 })).toBe('Customer · Prospect · Supplier')
    expect(thirdpartyRole({ client: 0, fournisseur: 0 })).toBe('—')
  })
})

describe('buildSqlSearch', () => {
  it('builds an OR filter across configured columns', () => {
    const f = buildSqlSearch(ENTITIES.invoices, 'abc')
    expect(f).toBe("(t.ref:like:'%abc%') or (t.ref_client:like:'%abc%')")
  })
  it('strips quotes/backslashes/percent that could break the filter', () => {
    const f = buildSqlSearch(ENTITIES.invoices, "a'b%c\\d")
    expect(f).toBe("(t.ref:like:'%abcd%') or (t.ref_client:like:'%abcd%')")
  })
  it('returns undefined for empty term or all-stripped term', () => {
    expect(buildSqlSearch(ENTITIES.invoices, '')).toBeUndefined()
    expect(buildSqlSearch(ENTITIES.invoices, '   ')).toBeUndefined()
    expect(buildSqlSearch(ENTITIES.invoices, "%%''")).toBeUndefined()
  })
})

describe('entity summaries', () => {
  it('thirdparty summary counts roles', () => {
    const m = ENTITIES.thirdparties.summary([
      { client: 1, fournisseur: 0, status: 1 },
      { client: 3, fournisseur: 1, status: 1 },
      { client: 0, fournisseur: 1, status: 0 },
    ])
    const byLabel = Object.fromEntries(m.map((x) => [x.label, x.value]))
    expect(byLabel['Third parties']).toBe('3')
    expect(byLabel['Customers']).toBe('2')
    expect(byLabel['Suppliers']).toBe('2')
    expect(byLabel['Active']).toBe('2')
  })
  it('product summary computes stock value', () => {
    const m = ENTITIES.products.summary([
      { status: 1, stock_reel: 2, price: 10 },
      { status: 0, stock_reel: 3, price: 5 },
    ])
    const byLabel = Object.fromEntries(m.map((x) => [x.label, x.value]))
    expect(byLabel['Products']).toBe('2')
    expect(byLabel['On sale']).toBe('1')
    expect(byLabel['Stock value']).toMatch(/35/)
  })

  it('money summary builds Today / totals / Outstanding for invoices', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    setBaseCurrency('OMR')
    const today = Math.floor(new Date('2026-06-15T09:00:00Z').getTime() / 1000)
    const old = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000)
    const rows = [
      { date: today, total_ht: '100', total_ttc: '110', status: 1, paye: 0 }, // unpaid, today
      { date: old, total_ht: '200', total_ttc: '220', status: 2, paye: 1 },   // paid, old
    ]
    const m = ENTITIES.invoices.summary(rows)
    const byLabel = Object.fromEntries(m.map((x) => [x.label, x]))
    expect(byLabel['Today'].sub).toBe('1 record')
    expect(byLabel['Today'].value).toMatch(/110/)
    expect(byLabel['Records'].value).toBe('2')
    expect(byLabel['Total (incl. tax)'].value).toMatch(/330/)
    expect(byLabel['Outstanding'].sub).toBe('1 unpaid')
    expect(byLabel['Outstanding'].value).toMatch(/110/)
  })

  it('pluralises a multi-record Today figure', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const today = Math.floor(new Date('2026-06-15T09:00:00Z').getTime() / 1000)
    const m = ENTITIES.orders.summary([
      { date_commande: today, total_ttc: '10' },
      { date_commande: today, total_ttc: '20' },
    ])
    const todayCard = m.find((x) => x.label === 'Today')
    expect(todayCard.sub).toBe('2 records')
  })
})

describe('column renderers', () => {
  it('invoice columns render refs, dates and money', () => {
    setBaseCurrency('OMR')
    const cols = Object.fromEntries(ENTITIES.invoices.columns.map((c) => [c.key, c]))
    const r = { ref: 'FA2026-001', date: '1719273600', total_ttc: '110', total_ht: '100', total_tva: '10' }
    expect(cols.ref.render(r)).toBe('FA2026-001')
    expect(cols.date.render(r)).toMatch(/2024/)
    expect(cols.total_ttc.render(r)).toMatch(/110/)
    expect(cols.ref.render({})).toBe('—')
  })
  it('product type column distinguishes service from product', () => {
    const typeCol = ENTITIES.products.columns.find((c) => c.key === 'type')
    expect(typeCol.render({ type: 1 })).toBe('Service')
    expect(typeCol.render({ type: 0 })).toBe('Product')
  })
  it('title / subtitle helpers fall back gracefully', () => {
    expect(ENTITIES.thirdparties.title({ name: 'Acme' })).toBe('Acme')
    expect(ENTITIES.thirdparties.title({ id: 9 })).toBe('#9')
    expect(ENTITIES.invoices.title({ id: 3 })).toBe('#3')
    expect(ENTITIES.thirdparties.subtitle({ town: 'Muscat', country_code: 'OM' })).toBe('Muscat, OM')
  })
})
