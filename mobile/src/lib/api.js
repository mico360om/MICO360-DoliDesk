// Dolibarr REST client. On native there is no CORS, so we call the API
// directly with the DOLAPIKEY header.

const ENDPOINTS = {
  thirdparties: '/thirdparties',
  invoices: '/invoices',
  products: '/products',
  orders: '/orders',
  proposals: '/proposals',
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
