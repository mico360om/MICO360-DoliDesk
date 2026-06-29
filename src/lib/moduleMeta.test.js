import { describe, expect, it } from 'vitest'
import { getModuleMeta, getModuleGroup, NON_BROWSABLE, SECTIONS } from './moduleMeta.js'

describe('getModuleMeta', () => {
  it('returns known label + icon', () => {
    expect(getModuleMeta('invoices')).toEqual({ label: 'Invoices', icon: '🧾' })
    expect(getModuleMeta('mico360statements').label).toBe('Client Statements')
  })
  it('falls back to a humanized label for unknown modules', () => {
    expect(getModuleMeta('some_custom_module')).toEqual({ label: 'Some Custom Module', icon: '📋' })
  })
})

describe('getModuleGroup', () => {
  it('maps modules to sections', () => {
    expect(getModuleGroup('thirdparties')).toBe('CRM')
    expect(getModuleGroup('invoices')).toBe('Sales')
    expect(getModuleGroup('supplierorders')).toBe('Purchases')
    expect(getModuleGroup('products')).toBe('Products & Stock')
  })
  it('defaults unknown modules to Other', () => {
    expect(getModuleGroup('whatever')).toBe('Other')
  })
  it('every group value is a declared section', () => {
    expect(SECTIONS).toContain(getModuleGroup('bankaccounts'))
  })
})

describe('NON_BROWSABLE', () => {
  it('hides API-only tags from nav', () => {
    expect(NON_BROWSABLE.has('login')).toBe(true)
    expect(NON_BROWSABLE.has('status')).toBe(true)
    expect(NON_BROWSABLE.has('invoices')).toBe(false)
  })
})
