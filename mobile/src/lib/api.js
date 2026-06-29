// Dolibarr REST client. On native there is no CORS, so we call the API
// directly with the DOLAPIKEY header.

const ENDPOINTS = {
  thirdparties: '/thirdparties',
  invoices: '/invoices',
  products: '/products',
  orders: '/orders',
  proposals: '/proposals',
  supplierorders: '/supplierorders',
  supplierinvoices: '/supplierinvoices',
}

export function apiBase(rawUrl) {
  let u = (rawUrl || '').trim().replace(/\/+$/, '')
  if (!u) throw new Error('No API URL configured')
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  if (!/\/api\/index\.php$/i.test(u)) {
    u = u.replace(/\/api$/i, '')
    u = u + '/api/index.php'
  }
  return u
}

function buildQuery(params = {}) {
  const parts = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return parts.length ? '?' + parts.join('&') : ''
}

async function request(profile, endpoint, { params, method = 'GET', timeout = 20000 } = {}) {
  if (!profile || !profile.url) throw new Error('No active profile')
  const url = apiBase(profile.url) + endpoint + buildQuery(params)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  let res
  try {
    res = await fetch(url, { method, headers: { DOLAPIKEY: profile.apiKey || '', Accept: 'application/json' }, signal: controller.signal })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error('Request timed out — check the API URL and connection.')
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
    const msg = (body && body.error && (body.error.message || body.error)) || (typeof body === 'string' && body.slice(0, 200)) || res.statusText
    const e = new Error(msg || `HTTP ${res.status}`)
    e.status = res.status
    throw e
  }
  if (body && body.error && body.error.code === 404) return []
  return body
}

export async function list(profile, type, opts = {}) {
  const ep = ENDPOINTS[type]
  if (!ep) throw new Error('Unknown record type: ' + type)
  const params = { limit: opts.limit ?? 50, page: opts.page ?? 0, sortfield: opts.sortfield || 't.rowid', sortorder: opts.sortorder || 'DESC' }
  if (opts.sqlfilters) params.sqlfilters = opts.sqlfilters
  const data = await request(profile, ep, { params })
  return Array.isArray(data) ? data : []
}

export async function getOne(profile, type, id) {
  const ep = ENDPOINTS[type]
  return request(profile, `${ep}/${encodeURIComponent(id)}`)
}

// Page through a record type up to `cap` rows (used by reports).
export async function listAll(profile, type, { cap = 3000, sortfield = 't.rowid', sortorder = 'DESC' } = {}) {
  const per = 100
  let page = 0
  const out = []
  while (out.length < cap) {
    const batch = await list(profile, type, { limit: per, page, sortfield, sortorder })
    out.push(...batch)
    if (batch.length < per) break
    page += 1
  }
  return out.slice(0, cap)
}

// Resolve third-party ids → display names. Caches the full list per profile.
const tpCache = new Map()
export async function resolveThirdparties(profile, ids) {
  const key = profile?.url || ''
  if (!tpCache.has(key)) tpCache.set(key, new Map())
  const cache = tpCache.get(key)
  const want = [...new Set((ids || []).map((x) => String(x)).filter((x) => x && x !== '0'))]
  const missing = want.filter((id) => !cache.has(id))
  if (missing.length) {
    try {
      const all = await listAll(profile, 'thirdparties', { cap: 2000 })
      for (const r of all) {
        const id = String(r.id ?? r.rowid)
        if (id) cache.set(id, r.name || r.name_alias || `#${id}`)
      }
    } catch {
      /* fall through to per-id */
    }
    await Promise.all(
      missing.filter((id) => !cache.has(id)).map(async (id) => {
        try {
          const r = await getOne(profile, 'thirdparties', id)
          cache.set(id, r.name || r.name_alias || `#${id}`)
        } catch {
          cache.set(id, `#${id}`)
        }
      })
    )
  }
  const out = {}
  for (const id of want) out[id] = cache.get(id) || `#${id}`
  return out
}

export function clearThirdpartyCache() {
  tpCache.clear()
}

// Dolibarr "modulepart" codes for the documents API, keyed by our type.
const MODULE_PART = {
  invoices: 'facture',
  orders: 'commande',
  proposals: 'propal',
  thirdparties: 'societe',
  products: 'product',
  supplierorders: 'commande_fournisseur',
  supplierinvoices: 'facture_fournisseur',
}

export function hasDocuments(type) {
  return Boolean(MODULE_PART[type])
}

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

async function downloadDocument(profile, type, originalFile) {
  const modulepart = MODULE_PART[type]
  if (!modulepart) throw new Error('Documents are not available for this record type.')
  const data = await request(profile, '/documents/download', { params: { modulepart, original_file: originalFile } })
  if (!data || !data.content) throw new Error('The document could not be retrieved.')
  return {
    filename: data.filename || originalFile.split('/').pop(),
    type: data['content-type'] || 'application/pdf',
    content: data.content, // base64
  }
}

// Find and download the record's PDF (base64). Tries the listed PDFs, then the
// conventional <ref>/<ref>.pdf path, collecting failures for a clear error.
export async function downloadRecordPdf(profile, type, id, ref) {
  const attempts = []
  const tryGet = async (orig) => {
    try { return await downloadDocument(profile, type, orig) } catch (e) { attempts.push(`${orig} → ${e.message}`); return null }
  }
  let docs = []
  try { docs = await listDocuments(profile, type, id) } catch (e) { attempts.push(`list → ${e.message}`) }
  const pdfs = docs.filter((d) => /\.pdf$/i.test(d.name || d.relativename || ''))
  for (const pdf of pdfs) {
    const rel = pdf.relativename || (pdf.level1name ? `${pdf.level1name}/${pdf.name}` : pdf.name)
    const got = await tryGet(rel)
    if (got) return got
  }
  if (ref) {
    const got = await tryGet(`${ref}/${ref}.pdf`)
    if (got) return got
  }
  const detail = attempts.length ? ` Details: ${attempts.join('; ')}` : ''
  throw new Error(`No downloadable PDF found. Open the record in Dolibarr once to generate its PDF, then retry.${detail}`)
}

export async function getCompany(profile) {
  try {
    return await request(profile, '/setup/company', { timeout: 15000 })
  } catch {
    return null
  }
}

// Username/password → token (POST first, GET fallback).
export async function login(url, loginName, password) {
  const base = apiBase(url)
  async function attempt(method) {
    let target = base + '/login'
    const opts = { method, headers: { Accept: 'application/json' } }
    if (method === 'POST') {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify({ login: loginName, password })
    } else {
      target += buildQuery({ login: loginName, password })
    }
    const res = await fetch(target, opts)
    const text = await res.text()
    let body
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { res, body }
  }
  let r = await attempt('POST')
  if (r.res.status === 404 || r.res.status === 405) r = await attempt('GET')
  const token = r.body && r.body.success && r.body.success.token
  if (r.res.ok && token) return token
  if (r.res.status === 403) throw new Error('Login failed — incorrect login or password.')
  throw new Error((r.body && r.body.error && (r.body.error.message || r.body.error)) || `Login failed (HTTP ${r.res.status})`)
}

export async function testConnection(profile) {
  try {
    const status = await request(profile, '/status', { timeout: 12000 })
    if (status && status.success) return { ok: true, version: status.success.dolibarr_version || 'unknown' }
  } catch (err) {
    if (err.status === 401 || err.status === 403) return { ok: false, error: 'Authentication failed — check the API key.' }
  }
  try {
    await request(profile, '/thirdparties', { params: { limit: 1 }, timeout: 12000 })
    return { ok: true, version: 'unknown' }
  } catch (err) {
    if (err.status === 401 || err.status === 403) return { ok: false, error: 'Authentication failed — check the API key.' }
    return { ok: false, error: err.message }
  }
}
