import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// Profile metadata (name, URL) is stored in AsyncStorage; the API key is kept
// in the OS secure store (Android Keystore / iOS Keychain) keyed by profile id.

const META_KEY = 'dolidesk:profiles'
const secureKey = (id) => `dolidesk_apikey_${String(id).replace(/[^A-Za-z0-9._-]/g, '')}`

function genId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

async function readMeta() {
  try {
    const s = await AsyncStorage.getItem(META_KEY)
    const d = s ? JSON.parse(s) : null
    return d && Array.isArray(d.profiles) ? d : { profiles: [], activeId: null }
  } catch {
    return { profiles: [], activeId: null }
  }
}
async function writeMeta(d) {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(d))
}

export async function listProfiles() {
  return readMeta()
}

export async function saveProfile({ id, name, url, apiKey }) {
  const meta = await readMeta()
  id = id || genId()
  const idx = meta.profiles.findIndex((p) => p.id === id)
  const record = { id, name: (name || '').trim() || 'Untitled', url: (url || '').trim().replace(/\/+$/, '') }
  // Prevent duplicate names.
  if (meta.profiles.some((p) => p.id !== id && p.name.toLowerCase() === record.name.toLowerCase())) {
    throw new Error(`A profile named “${record.name}” already exists.`)
  }
  if (idx >= 0) meta.profiles[idx] = record
  else meta.profiles.push(record)
  if (!meta.activeId) meta.activeId = id
  await writeMeta(meta)
  if (apiKey) await SecureStore.setItemAsync(secureKey(id), apiKey)
  return { ...meta }
}

export async function deleteProfile(id) {
  const meta = await readMeta()
  meta.profiles = meta.profiles.filter((p) => p.id !== id)
  if (meta.activeId === id) meta.activeId = meta.profiles.length ? meta.profiles[0].id : null
  await writeMeta(meta)
  try {
    await SecureStore.deleteItemAsync(secureKey(id))
  } catch {
    /* ignore */
  }
  return { ...meta }
}

export async function setActive(id) {
  const meta = await readMeta()
  if (meta.profiles.some((p) => p.id === id)) {
    meta.activeId = id
    await writeMeta(meta)
  }
  return { ...meta }
}

export async function getProfileWithKey(id) {
  const meta = await readMeta()
  const p = meta.profiles.find((x) => x.id === id)
  if (!p) return null
  const apiKey = await SecureStore.getItemAsync(secureKey(id))
  return { ...p, apiKey: apiKey || '' }
}

export async function getActiveProfile() {
  const meta = await readMeta()
  if (!meta.activeId) return null
  return getProfileWithKey(meta.activeId)
}
