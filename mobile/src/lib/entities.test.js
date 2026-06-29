import { afterEach, describe, expect, it } from 'vitest'
import { ENTITIES, ENTITY_LIST, getEntity, recordId, buildSqlSearch } from './entities.js'
import { setBaseCurrency } from './format.js'

afterEach(() => setBaseCurrency(null))

describe('registry', () => {
  it('lists the seven entities and resolves by key', () => {
    expect(ENTITY_LIST.map((e) => e.key)).toEqual(['thirdparties', 'invoices', 'products', 'orders', 'proposals', 'supplierorders', 'supplierinvoices'])
    expect(getEntity('invoices').label).toBe('Invoices')
    expect(getEntity('supplierinvoices').label).toBe('Supplier invoices')
    expect(getEntity('nope')).toBeNull()
  })
  it('every entity has the contract the screens depend on', () => {
    for (const e of ENTITY_LIST) {
      expect(typeof e.title).toBe('function')
      expect(typeof e.subtitle).toBe('function')
      expect(typeof e.status).toBe('function')
      expect(Array.isArray(e.searchFields)).toBe(true)
      expect(Array.isArray(e.detailFields)).toBe(true)
      expect(Array.isArray(e.columns)).toBe(true)
      expect(Array.isArray(e.sqlSearch)).toBe(true)
      expect(e.sortOptions.length).toBeGreaterThan(0)
      expect(e.sortOptions[0]).toMatchObject({ sortfield: expect.any(String), sortorder: expect.any(String) })
    }
  })
})

describe('buildSqlSearch', () => {
  it('builds an OR filter across the configured columns', () => {
    expect(buildSqlSearch(ENTITIES.invoices, 'abc')).toBe("(t.ref:like:'%abc%') or (t.ref_client:like:'%abc%')")
  })
  it('strips quote/backslash/percent injection chars', () => {
    expect(buildSqlSearch(ENTITIES.invoices, "a'b%c\\d")).toBe("(t.ref:like:'%abcd%') or (t.ref_client:like:'%abcd%')")
  })
  it('returns undefined for empty or fully-stripped terms', () => {
    expect(buildSqlSearch(ENTITIES.invoices, '')).toBeUndefined()
    expect(buildSqlSearch(ENTITIES.invoices, '   ')).toBeUndefined()
    expect(buildSqlSearch(ENTITIES.invoices, "%%''")).toBeUndefined()
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

describe('status decoders', () => {
  it('invoice', () => {
    const s = ENTITIES.invoices.status
    expect(s({ status: 0 }).label).toBe('Draft')
    expect(s({ status: 2 }).label).toBe('Paid')
    expect(s({ status: 1, paye: 1 }).label).toBe('Paid')
    expect(s({ status: 1, paye: 0 }).label).toBe('Unpaid')
    expect(s({ status: 3 }).label).toBe('Abandoned')
    expect(s({ statut: 0 }).label).toBe('Draft') // statut alias
  })
  it('order', () => {
    const s = ENTITIES.orders.status
    expect(s({ status: 3 })).toEqual({ label: 'Delivered', tone: 'green' })
    expect(s({ status: -1 }).label).toBe('Cancelled')
    expect(s({ status: 99 }).label).toBe('Unknown')
  })
  it('proposal', () => {
    const s = ENTITIES.proposals.status
    expect(s({ status: 2 }).label).toBe('Signed')
    expect(s({ status: 3 }).label).toBe('Not signed')
  })
  it('thirdparty / product', () => {
    expect(ENTITIES.thirdparties.status({ status: 1 }).label).toBe('Active')
    expect(ENTITIES.thirdparties.status({ status: 0 }).label).toBe('Inactive')
    expect(ENTITIES.products.status({ status: 1 }).label).toBe('On sale')
    expect(ENTITIES.products.status({ status: 0 }).label).toBe('Not for sale')
  })
  it('supplier order', () => {
    const s = ENTITIES.supplierorders.status
    expect(s({ status: 5 }).label).toBe('Received')
    expect(s({ status: 4 }).label).toBe('Partially received')
    expect(s({ status: 9 }).label).toBe('Refused')
    expect(s({ status: 0 }).label).toBe('Draft')
  })
  it('supplier invoice', () => {
    const s = ENTITIES.supplierinvoices.status
    expect(s({ status: 1, paye: 1 }).label).toBe('Paid')
    expect(s({ status: 1, paye: 0 }).label).toBe('Unpaid')
    expect(s({ status: 0 }).label).toBe('Draft')
  })
})

describe('title / subtitle / amount', () => {
  it('falls back gracefully', () => {
    expect(ENTITIES.thirdparties.title({ name: 'Acme' })).toBe('Acme')
    expect(ENTITIES.thirdparties.title({ id: 9 })).toBe('#9')
    expect(ENTITIES.invoices.title({ id: 3 })).toBe('#3')
    expect(ENTITIES.thirdparties.subtitle({ town: 'Muscat', country_code: 'OM' })).toBe('Muscat, OM')
  })
  it('amount renders money for documents', () => {
    setBaseCurrency('OMR')
    expect(ENTITIES.invoices.amount({ total_ttc: '110' })).toMatch(/110/)
    expect(ENTITIES.thirdparties.amount).toBeUndefined()
  })
})
