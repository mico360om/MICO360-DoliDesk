'use strict'

const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Persistent application settings, stored as JSON in userData so they
// survive restarts. Sensitive values (the PIN) are stored only as a salted
// hash, never in plaintext.

const DEFAULTS = {
  display: {
    theme: 'system', // 'light' | 'dark' | 'system'
    density: 'comfortable', // 'comfortable' | 'compact'
    zoom: 90, // default slightly zoomed out so more fits; 80–175 selectable
    dashboardLayout: 'default',
    language: 'en', // UI language code
    hiddenMenu: [], // main-menu items the user has hidden
  },
  updates: {
    autoUpdate: true,
    checkOnStartup: true,
  },
  security: {
    lockEnabled: false,
    pinHash: null,
    pinSalt: null,
    maskApiKey: true,
  },
  notifications: {
    updates: true,
    apiErrors: true,
    syncComplete: true,
  },
}

function file() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function deepMerge(base, override) {
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const [k, v] of Object.entries(override || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

function read() {
  try {
    const data = JSON.parse(fs.readFileSync(file(), 'utf8'))
    return deepMerge(DEFAULTS, data)
  } catch {
    return deepMerge(DEFAULTS, {})
  }
}

function write(data) {
  fs.writeFileSync(file(), JSON.stringify(data, null, 2), 'utf8')
}

// Strip secrets before handing settings to the renderer.
function sanitize(s) {
  const { security, ...rest } = s
  const { pinHash, pinSalt, ...safeSecurity } = security
  return { ...rest, security: { ...safeSecurity, hasPin: Boolean(pinHash) } }
}

function getSettings() {
  return sanitize(read())
}

function saveSettings(partial) {
  // Never let the renderer write security secrets directly.
  const clean = { ...partial }
  if (clean.security) {
    const { pinHash, pinSalt, hasPin, ...rest } = clean.security
    clean.security = rest
  }
  const merged = deepMerge(read(), clean)
  write(merged)
  return sanitize(merged)
}

function resetSettings() {
  // Preserve any configured PIN across a settings reset.
  const current = read()
  const next = deepMerge(DEFAULTS, {})
  next.security.pinHash = current.security.pinHash
  next.security.pinSalt = current.security.pinSalt
  next.security.lockEnabled = current.security.lockEnabled
  write(next)
  return sanitize(next)
}

function hashPin(pin, salt) {
  return crypto.createHash('sha256').update(salt + ':' + pin).digest('hex')
}

function setPin(pin) {
  const data = read()
  const salt = crypto.randomBytes(16).toString('hex')
  data.security.pinSalt = salt
  data.security.pinHash = hashPin(pin, salt)
  data.security.lockEnabled = true
  write(data)
  return sanitize(data)
}

function verifyPin(pin) {
  const data = read()
  if (!data.security.pinHash) return true
  return hashPin(pin, data.security.pinSalt) === data.security.pinHash
}

function clearPin() {
  const data = read()
  data.security.pinHash = null
  data.security.pinSalt = null
  data.security.lockEnabled = false
  write(data)
  return sanitize(data)
}

// Full backup includes raw settings (with PIN hash) for same-machine restore.
function exportBackup() {
  return read()
}

function importBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file')
  write(deepMerge(DEFAULTS, data))
  return sanitize(read())
}

module.exports = {
  getSettings, saveSettings, resetSettings,
  setPin, verifyPin, clearPin,
  exportBackup, importBackup,
  lockEnabled: () => read().security.lockEnabled && Boolean(read().security.pinHash),
}
