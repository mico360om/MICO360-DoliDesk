import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiBase, list, getOne, login, getCompany, testConnection, listAll, resolveThirdparties, clearThirdpartyCache, downloadRecordPdf, hasDocuments } from './api.js'

// Build a fake fetch Response.
function reply({ ok = true, status = 200, statusText = 'OK', json, text }) {
  const bodyText = text !== undefined ? text : JSON.stringify(json)
  return Promise.resolve({ ok, status, statusText, text: () => Promise.resolve(bodyText) })
}

const PROFILE = { url: 'https://erp.example.com', apiKey: 'KEY123' }

beforeEach(() => { global.fetch = vi.fn() })
afterEach(() => { vi.restoreAllMocks() })

describe('apiBase', () => {
  it('appends /api/index.php and trims slashes', () => {
    expect(apiBase('https://erp.example.com')).toBe('https://erp.example.com/api/index.php')
    expect(apiBase('https://erp.example.com/')).toBe('https://erp.example.com/api/index.php')
    expect(apiBase('https://erp.example.com/api')).toBe('https://erp.example.com/api/index.php')
    expect(apiBase('https://erp.example.com/api/index.php')).toBe('https://erp.example.com/api/index.php')
  })
  it('adds https:// when scheme missing', () => {
    expect(apiBase('erp.example.com')).toBe('https://erp.example.com/api/index.php')
  })
  it('throws on empty', () => {
    expect(() => apiBase('')).toThrow(/No API URL/)
  })
})

describe('list', () => {
  it('builds the URL with paging + sort params and sends the API key header', async () => {
    global.fetch.mockReturnValueOnce(reply({ json: [{ id: 1 }] }))
    const rows = await list(PROFILE, 'invoices', { limit: 25, page: 2 })
    expect(rows).toEqual([{ id: 1 }])
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toContain('/api/index.php/invoices?')
    expect(url).toContain('limit=25')
    expect(url).toContain('page=2')
    expect(url).toContain('sortfield=t.rowid')
    expect(opts.headers.DOLAPIKEY).toBe('KEY123')
  })
  it('passes sqlfilters when provided', async () => {
    global.fetch.mockReturnValueOnce(reply({ json: [] }))
    await list(PROFILE, 'invoices', { sqlfilters: "(t.ref:like:'%x%')" })
    expect(global.fetch.mock.calls[0][0]).toContain('sqlfilters=')
  })
  it('returns [] when the API returns a non-array', async () => {
    global.fetch.mockReturnValueOnce(reply({ json: { error: 'oops' } }))
    expect(await list(PROFILE, 'invoices')).toEqual([])
  })
  it('throws on an unknown type', async () => {
    await expect(list(PROFILE, 'aliens')).rejects.toThrow(/Unknown record type/)
  })
})

describe('getOne', () => {
  it('requests the record by id', async () => {
    global.fetch.mockReturnValueOnce(reply({ json: { id: 7, ref: 'FA7' } }))
    const r = await getOne(PROFILE, 'invoices', 7)
    expect(r.ref).toBe('FA7')
    expect(global.fetch.mock.calls[0][0]).toContain('/invoices/7')
  })
})

describe('request error handling (via list)', () => {
  it('throws an error carrying the HTTP status', async () => {
    global.fetch.mockReturnValueOnce(reply({ ok: false, status: 401, json: { error: { message: 'bad key' } } }))
    await expect(list(PROFILE, 'invoices')).rejects.toMatchObject({ message: 'bad key', status: 401 })
  })
  it('maps fetch network failure to a friendly message', async () => {
    global.fetch.mockRejectedValueOnce(new Error('boom'))
    await expect(list(PROFILE, 'invoices')).rejects.toThrow(/Could not reach the server/)
  })
})

describe('getCompany', () => {
  it('returns null instead of throwing on failure', async () => {
    global.fetch.mockReturnValueOnce(reply({ ok: false, status: 500, json: {} }))
    expect(await getCompany(PROFILE)).toBeNull()
  })
})

describe('login', () => {
  it('returns the token from a successful POST', async () => {
    global.fetch.mockReturnValueOnce(reply({ json: { success: { token: 'TOK' } } }))
    expect(await login('https://erp.example.com', 'u', 'p')).toBe('TOK')
    const [, opts] = global.fetch.mock.calls[0]
    expect(opts.method).toBe('POST')
  })
  it('falls back to GET when POST is 405', async () => {
    global.fetch
      .mockReturnValueOnce(reply({ ok: false, status: 405, json: {} }))
      .mockReturnValueOnce(reply({ json: { success: { token: 'TOK2' } } }))
    expect(await login('https://erp.example.com', 'u', 'p')).toBe('TOK2')
    expect(global.fetch.mock.calls[1][1].method).toBe('GET')
  })
  it('throws a clear message on 403', async () => {
    global.fetch.mockReturnValueOnce(reply({ ok: false, status: 403, json: {} }))
    await expect(login('https://erp.example.com', 'u', 'p')).rejects.toThrow(/incorrect login or password/)
  })
})

describe('listAll', () => {
  it('pages until a short batch and respects the cap', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    global.fetch
      .mockReturnValueOnce(reply({ json: full }))           // page 0 (full)
      .mockReturnValueOnce(reply({ json: [{ id: 100 }] }))  // page 1 (short → stop)
    const rows = await listAll(PROFILE, 'invoices', { cap: 3000 })
    expect(rows).toHaveLength(101)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('resolveThirdparties', () => {
  it('fetches the list once and maps ids to names', async () => {
    clearThirdpartyCache()
    global.fetch.mockReturnValueOnce(reply({ json: [{ id: 1, name: 'Acme' }, { id: 2, name: 'Globex' }] }))
    const names = await resolveThirdparties(PROFILE, ['1', '2', '0', ''])
    expect(names).toEqual({ 1: 'Acme', 2: 'Globex' })
  })
})

describe('hasDocuments', () => {
  it('knows which types support documents', () => {
    expect(hasDocuments('invoices')).toBe(true)
    expect(hasDocuments('thirdparties')).toBe(true)
    expect(hasDocuments('nope')).toBe(false)
  })
})

describe('downloadRecordPdf', () => {
  it('returns base64 content from a listed PDF', async () => {
    global.fetch
      .mockReturnValueOnce(reply({ json: [{ name: 'FA2026-001.pdf', relativename: 'FA2026-001/FA2026-001.pdf' }] })) // list
      .mockReturnValueOnce(reply({ json: { filename: 'FA2026-001.pdf', 'content-type': 'application/pdf', content: 'JVBERi0=' } })) // download
    const pdf = await downloadRecordPdf(PROFILE, 'invoices', 7, 'FA2026-001')
    expect(pdf.content).toBe('JVBERi0=')
    expect(pdf.filename).toBe('FA2026-001.pdf')
  })
  it('falls back to <ref>/<ref>.pdf, then throws a clear error', async () => {
    global.fetch
      .mockReturnValueOnce(reply({ json: [] }))                          // list: none
      .mockReturnValueOnce(reply({ ok: false, status: 404, json: {} }))  // ref path: fail
    await expect(downloadRecordPdf(PROFILE, 'invoices', 7, 'FA2026-001')).rejects.toThrow(/No downloadable PDF/)
  })
})

describe('testConnection', () => {
  it('reports version from /status', async () => {
    global.fetch.mockReturnValueOnce(reply({ json: { success: { dolibarr_version: '20.0.0' } } }))
    expect(await testConnection(PROFILE)).toEqual({ ok: true, version: '20.0.0' })
  })
  it('falls back to /thirdparties when /status is unavailable', async () => {
    global.fetch
      .mockReturnValueOnce(reply({ ok: false, status: 404, json: {} })) // status
      .mockReturnValueOnce(reply({ json: [{ id: 1 }] })) // thirdparties
    expect(await testConnection(PROFILE)).toEqual({ ok: true, version: 'unknown' })
  })
  it('detects auth failure', async () => {
    global.fetch
      .mockReturnValueOnce(reply({ ok: false, status: 403, json: {} }))
    expect(await testConnection(PROFILE)).toEqual({ ok: false, error: 'Authentication failed — check the API key.' })
  })
})
