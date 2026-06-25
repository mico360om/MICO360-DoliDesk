'use strict'

// Thin wrapper over the Dolibarr REST API. All requests run here in the
// main process (not the renderer) so the API key never reaches the web
// context and we sidestep browser CORS restrictions entirely.

// Dolibarr's REST entry point is normally <host>/api/index.php. Accept
// either the bare host or the full entry point from the user.
function apiBase(rawUrl) {
  let u = (rawUrl || '').trim().replace(/\/+$/, '')
  if (!u) throw new Error('No API URL configured')
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  if (!/\/api\/index\.php$/i.test(u)) {
    // Tolerate a trailing /api too.
    u = u.replace(/\/api$/i, '')
    u = u + '/api/index.php'
  }
  return u
}

function buildQuery(params = {}) {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    usp.append(k, String(v))
  }
  const s = usp.toString()
  return s ? '?' + s : ''
}

async function request(profile, endpoint, { params, method = 'GET', timeout = 20000 } = {}) {
  if (!profile || !profile.url) throw new Error('No active profile')
  const url = apiBase(profile.url) + endpoint + buildQuery(params)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        DOLAPIKEY: profile.apiKey || '',
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error('Request timed out — check the API URL and your connection.')
    throw new Error('Could not reach the server: ' + err.message)
  }
  clearTimeout(timer)

  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (!res.ok) {
    // Dolibarr returns { error: { code, message } } on failure.
    const msg =
      (body && body.error && (body.error.message || body.error)) ||
      (typeof body === 'string' && body.slice(0, 200)) ||
      res.statusText
    const e = new Error(msg || `HTTP ${res.status}`)
    e.status = res.status
    throw e
  }

  // Dolibarr returns [] (literally) when a list query matches nothing,
  // sometimes wrapped in an error object with code 404 — normalise to [].
  if (body && body.error && body.error.code === 404) return []
  return body
}

// ---- Entity registry -------------------------------------------------------
// Each entity maps to its list endpoint plus the fields we surface in the
// table and the human label. Keeps the renderer generic.
const ENTITIES = {
  thirdparties: { endpoint: '/thirdparties', label: 'Third parties' },
  invoices: { endpoint: '/invoices', label: 'Invoices' },
  products: { endpoint: '/products', label: 'Products' },
  orders: { endpoint: '/orders', label: 'Orders' },
  proposals: { endpoint: '/proposals', label: 'Proposals' },
  supplierorders: { endpoint: '/supplierorders', label: 'Supplier orders' },
  supplierinvoices: { endpoint: '/supplierinvoices', label: 'Supplier invoices' },
}

function entityDef(type) {
  const def = ENTITIES[type]
  if (!def) throw new Error('Unknown record type: ' + type)
  return def
}

async function list(profile, type, opts = {}) {
  const def = entityDef(type)
  const params = {
    limit: opts.limit ?? 100,
    page: opts.page ?? 0,
    sortfield: opts.sortfield || 't.rowid',
    sortorder: opts.sortorder || 'DESC',
  }
  if (opts.sqlfilters) params.sqlfilters = opts.sqlfilters
  const data = await request(profile, def.endpoint, { params })
  return Array.isArray(data) ? data : []
}

async function getOne(profile, type, id) {
  const def = entityDef(type)
  return request(profile, `${def.endpoint}/${encodeURIComponent(id)}`)
}

// Generic list/get against an arbitrary API endpoint (used to browse custom
// modules discovered via swagger, which aren't in the fixed entity registry).
async function listRaw(profile, endpoint, opts = {}) {
  const ep = '/' + String(endpoint).replace(/^\/+/, '')
  const params = { limit: opts.limit ?? 50, page: opts.page ?? 0 }
  if (opts.sortfield) params.sortfield = opts.sortfield
  if (opts.sortorder) params.sortorder = opts.sortorder
  const data = await request(profile, ep, { params })
  return Array.isArray(data) ? data : []
}

async function getRaw(profile, endpoint, id) {
  const ep = '/' + String(endpoint).replace(/^\/+/, '')
  return request(profile, `${ep}/${encodeURIComponent(id)}`)
}

// Paginate through every record (up to `cap`) so totals/exports reflect the
// whole dataset, not just the first page. Returns { rows, complete } where
// complete=false means the cap was hit before exhausting the data.
async function listAll(profile, type, opts = {}) {
  const cap = opts.cap ?? 2000
  const pageSize = 100
  let page = 0
  let all = []
  let complete = true
  // Hard stop on page count as a runaway guard.
  for (let i = 0; i < 200; i++) {
    const batch = await list(profile, type, {
      limit: pageSize,
      page,
      sortfield: opts.sortfield,
      sortorder: opts.sortorder,
      sqlfilters: opts.sqlfilters,
    })
    all = all.concat(batch)
    if (batch.length < pageSize) {
      complete = true
      break
    }
    if (all.length >= cap) {
      complete = false
      break
    }
    page++
  }
  return { rows: all.slice(0, cap), complete }
}

// Per-process cache of third-party id -> name, keyed by instance URL. On the
// first lookup we bulk-prefetch the directory once, then resolve any stragglers
// individually. Lets lists/dashboards show customer names instead of socids.
const tpCache = new Map()

// Clear all in-memory caches (third-party names). Used by Data & Cache settings.
function clearCaches() {
  tpCache.clear()
}

async function resolveThirdparties(profile, ids) {
  const key = profile.url
  if (!tpCache.has(key)) tpCache.set(key, { prefetched: false, names: new Map() })
  const entry = tpCache.get(key)
  const want = [...new Set((ids || []).map((x) => String(x)).filter((x) => x && x !== '0'))]

  if (!entry.prefetched) {
    try {
      const { rows } = await listAll(profile, 'thirdparties', { cap: 2000 })
      for (const r of rows) {
        const id = String(r.id ?? r.rowid)
        if (id) entry.names.set(id, r.name || r.name_alias || `#${id}`)
      }
    } catch {
      /* fall through to per-id resolution */
    }
    entry.prefetched = true
  }

  const missing = want.filter((id) => !entry.names.has(id))
  await Promise.all(
    missing.map(async (id) => {
      try {
        const r = await getOne(profile, 'thirdparties', id)
        entry.names.set(id, r.name || r.name_alias || `#${id}`)
      } catch {
        entry.names.set(id, `#${id}`)
      }
    })
  )

  const out = {}
  for (const id of want) out[id] = entry.names.get(id) || `#${id}`
  return out
}

// Standard Dolibarr REST API resource names (lowercased). Anything the
// instance exposes that isn't in this set is treated as a custom / add-on
// module. The list is deliberately generous to avoid false "custom" flags;
// it still won't be perfect across every Dolibarr version, so the UI labels
// the classification as a heuristic.
const CORE_MODULES = new Set([
  'login', 'status', 'setup', 'documents', 'tools', 'boxes',
  'thirdparties', 'contacts', 'users', 'usergroups',
  'invoices', 'supplierinvoices', 'orders', 'supplierorders',
  'proposals', 'supplierproposals', 'products', 'warehouses', 'stockmovements',
  'categories', 'projects', 'tasks', 'agendaevents', 'contracts', 'interventions',
  'shipments', 'receptions', 'expensereports', 'members', 'memberstypes', 'subscriptions',
  'bankaccounts', 'multicurrencies', 'tickets', 'knowledgemanagement',
  'recruitments', 'partnerships', 'workstations', 'donations', 'margins',
  'holidays', 'events', 'ficheinter', 'prelevements',
])

// Dolibarr "modulepart" codes used by the documents API, keyed by our type.
const MODULE_PART = {
  invoices: 'facture',
  orders: 'commande',
  proposals: 'propal',
  thirdparties: 'societe',
  products: 'product',
  supplierorders: 'commande_fournisseur',
  supplierinvoices: 'facture_fournisseur',
}

// List the files attached to a record (typically the generated PDF).
async function listDocuments(profile, type, id) {
  const modulepart = MODULE_PART[type]
  if (!modulepart) return []
  try {
    const data = await request(profile, '/documents', { params: { modulepart, id } })
    return Array.isArray(data) ? data : []
  } catch (err) {
    if (err.status === 404) return []
    throw err
  }
}

// Download a single document. Dolibarr returns base64-encoded content.
// Returns { filename, type, content (base64) }.
async function downloadDocument(profile, type, originalFile) {
  const modulepart = MODULE_PART[type]
  if (!modulepart) throw new Error('Documents are not available for this record type.')
  const data = await request(profile, '/documents/download', {
    params: { modulepart, original_file: originalFile },
  })
  if (!data || !data.content) throw new Error('The document could not be retrieved.')
  return {
    filename: data.filename || originalFile.split('/').pop(),
    type: data['content-type'] || 'application/octet-stream',
    content: data.content,
  }
}

// Find and download the record's PDF. Tries every PDF in the document list,
// then the conventional <ref>/<ref>.pdf path, collecting failures so the
// error explains exactly what was attempted.
async function downloadRecordPdf(profile, type, id, ref) {
  const attempts = []
  const tryGet = async (orig) => {
    try {
      return await downloadDocument(profile, type, orig)
    } catch (e) {
      attempts.push(`${orig} → ${e.message}`)
      return null
    }
  }

  let docs = []
  try {
    docs = await listDocuments(profile, type, id)
  } catch (e) {
    attempts.push(`list documents → ${e.message}`)
  }

  const pdfs = docs.filter((d) => /\.pdf$/i.test(d.name || d.relativename || d.relativname || ''))
  for (const pdf of pdfs) {
    const rel =
      pdf.relativename ||
      pdf.relativname ||
      (pdf.level1name ? `${pdf.level1name}/${pdf.name}` : pdf.name)
    const got = await tryGet(rel)
    if (got) return got
  }

  if (ref) {
    const got = await tryGet(`${ref}/${ref}.pdf`)
    if (got) return got
  }

  const detail = attempts.length ? ` Details: ${attempts.join('; ')}` : ''
  throw new Error(
    `No downloadable PDF was found. The document may not be generated yet — open the record in Dolibarr once to generate its PDF, then retry.${detail}`
  )
}

// ---- MICO360 Client Statement module (/mico360statements) -----------------
// socid 0 = consolidated (all customers).
async function getStatement(profile, socid, params = {}) {
  return request(profile, `/mico360statements/${encodeURIComponent(socid)}`, { params, timeout: 30000 })
}
async function getStatementAgeing(profile, socid, params = {}) {
  return request(profile, `/mico360statements/ageing/${encodeURIComponent(socid)}`, { params, timeout: 20000 })
}
async function getStatementEmailLog(profile, params = {}) {
  const data = await request(profile, '/mico360statements/emaillog', { params })
  return Array.isArray(data) ? data : data?.rows || data?.lines || []
}

// Fetch the configured company ("mysoc") details for the active instance —
// name, address, logo filename, currency, etc. Used to brand the UI per
// profile. Returns null if the endpoint is unavailable.
async function getCompany(profile) {
  const data = await request(profile, '/setup/company', { timeout: 15000 })
  return data && typeof data === 'object' ? data : null
}

// Fetch the active company's logo image as a data URL (for in-app branding /
// window icon). Prefers the square logo. Returns null if none / unavailable.
async function getCompanyLogo(profile, companyMaybe) {
  let company = companyMaybe
  if (!company) {
    try {
      company = await getCompany(profile)
    } catch {
      return null
    }
  }
  const logo = company && (company.logo_squarred || company.logo || company.logo_small)
  if (!logo) return null
  try {
    const data = await request(profile, '/documents/download', {
      params: { modulepart: 'mycompany', original_file: 'logos/' + logo },
      timeout: 15000,
    })
    if (data && data.content) {
      const mime = data['content-type'] || 'image/png'
      return { dataUrl: `data:${mime};base64,${data.content}`, filename: logo }
    }
  } catch {
    /* logo not accessible — fall back to bundled branding */
  }
  return null
}

// Discover enabled modules by reading the API's swagger spec. Each path is
// grouped by its tag (falling back to the first URL segment); the resulting
// groups map 1:1 to the modules that expose a REST API.
async function getModules(profile) {
  if (!profile || !profile.url) throw new Error('No active profile')
  // Pass the key both as header and query param — the explorer honours the
  // query param, and only returns the full spec when authenticated.
  const url =
    apiBase(profile.url) + '/explorer/swagger.json' + buildQuery({ DOLAPIKEY: profile.apiKey || '' })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)
  let res
  try {
    res = await fetch(url, {
      headers: { DOLAPIKEY: profile.apiKey || '', Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error('Timed out fetching the API spec.')
    throw new Error('Could not reach the server: ' + err.message)
  }
  clearTimeout(timer)

  const text = await res.text()
  let spec
  try {
    spec = JSON.parse(text)
  } catch {
    throw new Error('The API spec was not valid JSON (HTTP ' + res.status + ').')
  }
  if (!res.ok) {
    const msg = (spec && spec.error && (spec.error.message || spec.error)) || `HTTP ${res.status}`
    throw new Error(msg)
  }

  const paths = (spec && spec.paths) || {}
  const groups = new Map()
  for (const [p, ops] of Object.entries(paths)) {
    if (!ops || typeof ops !== 'object') continue
    const segment = p.split('/').filter(Boolean)[0] || '(root)'
    for (const [method, op] of Object.entries(ops)) {
      if (!op || typeof op !== 'object') continue
      const tag = (Array.isArray(op.tags) && op.tags[0]) || segment
      const key = String(tag).toLowerCase()
      if (!groups.has(key)) groups.set(key, { name: tag, key, paths: new Set(), methods: new Set() })
      const g = groups.get(key)
      g.paths.add(p)
      g.methods.add(method.toUpperCase())
    }
  }

  const modules = [...groups.values()]
    .map((g) => ({
      name: g.name,
      key: g.key,
      paths: g.paths.size,
      methods: [...g.methods].sort(),
      isCore: CORE_MODULES.has(g.key),
    }))
    // Hide the always-present auth/system tags from the "custom" reckoning UI.
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    host: spec.host || null,
    apiVersion: (spec.info && spec.info.version) || spec.swagger || null,
    total: modules.length,
    customCount: modules.filter((m) => !m.isCore).length,
    modules,
  }
}

// Exchange a username + password for a Dolibarr API token via /login. The
// token is what we store (encrypted) and send as DOLAPIKEY thereafter — the
// password is never persisted. We POST first so the password travels in the
// request body (not the URL / server access logs), and fall back to GET for
// older Dolibarr builds whose /login route is GET-only.
async function login(url, loginName, password, reset) {
  if (!url) throw new Error('No API URL provided')
  if (!loginName || !password) throw new Error('Enter both the login and password.')
  const base = apiBase(url)

  async function attempt(method) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const opts = { method, headers: { Accept: 'application/json' }, signal: controller.signal }
    let target = base + '/login'
    if (method === 'POST') {
      opts.headers['Content-Type'] = 'application/json'
      const payload = { login: loginName, password }
      if (reset) payload.reset = 1
      opts.body = JSON.stringify(payload)
    } else {
      const params = { login: loginName, password }
      if (reset) params.reset = 1
      target += buildQuery(params)
    }
    try {
      const res = await fetch(target, opts)
      const text = await res.text()
      let body
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = text
      }
      return { res, body }
    } finally {
      clearTimeout(timer)
    }
  }

  let result
  try {
    result = await attempt('POST')
    // 404/405 → route doesn't accept POST; retry with GET.
    if (result.res.status === 404 || result.res.status === 405) result = await attempt('GET')
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Login timed out — check the API URL.')
    try {
      result = await attempt('GET')
    } catch (e2) {
      if (e2.name === 'AbortError') throw new Error('Login timed out — check the API URL.')
      throw new Error('Could not reach the server: ' + e2.message)
    }
  }

  const { res, body } = result
  const token = body && body.success && body.success.token
  if (res.ok && token) return token
  if (res.status === 403) throw new Error('Login failed — incorrect login or password.')
  const msg =
    (body && body.error && (body.error.message || body.error)) ||
    (body && body.success && body.success.message) ||
    `Login failed (HTTP ${res.status})`
  throw new Error(msg)
}

// Connectivity / credential test. /status is public-ish and returns the
// Dolibarr version; fall back to a 1-row thirdparties probe if disabled.
async function testConnection(profile) {
  try {
    const status = await request(profile, '/status', { timeout: 12000 })
    if (status && status.success) {
      return { ok: true, version: status.success.dolibarr_version || 'unknown' }
    }
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      return { ok: false, error: 'Authentication failed — check the API key.' }
    }
    // /status may be unavailable; try a real list probe before giving up.
  }
  try {
    await request(profile, '/thirdparties', { params: { limit: 1 }, timeout: 12000 })
    return { ok: true, version: 'unknown' }
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      return { ok: false, error: 'Authentication failed — check the API key.' }
    }
    return { ok: false, error: err.message }
  }
}

module.exports = {
  request, list, listAll, getOne, listRaw, getRaw, resolveThirdparties, clearCaches,
  login, getModules, getCompany, getCompanyLogo, testConnection, ENTITIES, apiBase,
  listDocuments, downloadDocument, downloadRecordPdf,
  getStatement, getStatementAgeing, getStatementEmailLog,
}
