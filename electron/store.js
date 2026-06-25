'use strict'

const { app, safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Profiles are persisted to a single JSON file in the app's userData
// directory. The API key for each profile is encrypted at rest with
// Electron's safeStorage (backed by the OS credential vault: DPAPI on
// Windows, Keychain on macOS, libsecret on Linux). Only an encrypted
// blob ever touches disk — the plaintext key lives in the main process
// memory and is never exposed to the renderer.

function storeFile() {
  return path.join(app.getPath('userData'), 'profiles.json')
}

function readRaw() {
  try {
    const txt = fs.readFileSync(storeFile(), 'utf8')
    const data = JSON.parse(txt)
    return Array.isArray(data.profiles) ? data : { profiles: [], activeId: null }
  } catch {
    return { profiles: [], activeId: null }
  }
}

function writeRaw(data) {
  fs.writeFileSync(storeFile(), JSON.stringify(data, null, 2), 'utf8')
}

function encryptKey(plain) {
  if (safeStorage.isEncryptionAvailable()) {
    return { enc: 'safeStorage', value: safeStorage.encryptString(plain).toString('base64') }
  }
  // Fallback (e.g. headless Linux without a keyring): light obfuscation only.
  return { enc: 'plain', value: Buffer.from(plain, 'utf8').toString('base64') }
}

function decryptKey(stored) {
  if (!stored) return ''
  try {
    if (stored.enc === 'safeStorage') {
      return safeStorage.decryptString(Buffer.from(stored.value, 'base64'))
    }
    return Buffer.from(stored.value, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

// Public API key is decrypted on demand; renderer never receives it.
function getApiKey(id) {
  const data = readRaw()
  const p = data.profiles.find((x) => x.id === id)
  return p ? decryptKey(p._key) : ''
}

// Returns profiles with the encrypted key stripped — safe for the renderer.
function listProfiles() {
  const data = readRaw()
  return {
    activeId: data.activeId,
    profiles: data.profiles.map(({ _key, ...rest }) => rest),
  }
}

function saveProfile(profile) {
  const data = readRaw()
  const id = profile.id || crypto.randomUUID()
  const idx = data.profiles.findIndex((x) => x.id === id)

  const name = (profile.name || '').trim() || 'Untitled'
  const url = normalizeUrl(profile.url)

  // Prevent duplicates: no two profiles may share a name (case-insensitive),
  // and no two may point at the same URL — that would be ambiguous in the
  // account switcher.
  const nameClash = data.profiles.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())
  if (nameClash) throw new Error(`A profile named “${name}” already exists.`)
  const urlClash = data.profiles.some((p) => p.id !== id && p.url.toLowerCase() === url.toLowerCase())
  if (urlClash) throw new Error('A profile with this API URL already exists.')

  const record = {
    id,
    name,
    url,
    createdAt: idx >= 0 ? data.profiles[idx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Only re-encrypt when a new key is provided; otherwise keep the old one.
  if (profile.apiKey && profile.apiKey.length > 0) {
    record._key = encryptKey(profile.apiKey)
  } else if (idx >= 0) {
    record._key = data.profiles[idx]._key
  } else {
    record._key = encryptKey('')
  }

  if (idx >= 0) data.profiles[idx] = record
  else data.profiles.push(record)

  if (!data.activeId) data.activeId = id
  writeRaw(data)
  return listProfiles()
}

function deleteProfile(id) {
  const data = readRaw()
  data.profiles = data.profiles.filter((x) => x.id !== id)
  if (data.activeId === id) {
    data.activeId = data.profiles.length ? data.profiles[0].id : null
  }
  writeRaw(data)
  return listProfiles()
}

function setActive(id) {
  const data = readRaw()
  if (data.profiles.some((x) => x.id === id)) {
    data.activeId = id
    writeRaw(data)
  }
  return listProfiles()
}

function getActiveProfile() {
  const data = readRaw()
  const p = data.profiles.find((x) => x.id === data.activeId)
  if (!p) return null
  return { id: p.id, name: p.name, url: p.url, apiKey: decryptKey(p._key) }
}

function normalizeUrl(url) {
  let u = (url || '').trim().replace(/\/+$/, '')
  return u
}

// Remove every profile and its stored (encrypted) API key.
function clearAllCredentials() {
  writeRaw({ profiles: [], activeId: null })
  return listProfiles()
}

// Raw profiles (with encrypted keys) for same-machine backup/restore.
function exportProfiles() {
  return readRaw()
}

function importProfiles(data) {
  if (!data || !Array.isArray(data.profiles)) throw new Error('Invalid profiles backup')
  writeRaw({ profiles: data.profiles, activeId: data.activeId || (data.profiles[0] && data.profiles[0].id) || null })
  return listProfiles()
}

module.exports = {
  listProfiles,
  saveProfile,
  deleteProfile,
  setActive,
  getActiveProfile,
  getApiKey,
  clearAllCredentials,
  exportProfiles,
  importProfiles,
}
