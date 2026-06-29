import AsyncStorage from '@react-native-async-storage/async-storage'

// Lightweight read-through cache for last-loaded data, so screens can show
// something when the device is offline. Keyed by profile URL + a logical key.

const PREFIX = 'dolidesk:cache:'
const keyFor = (profileUrl, key) => `${PREFIX}${profileUrl || ''}::${key}`

export async function cacheSet(profileUrl, key, data) {
  try {
    await AsyncStorage.setItem(keyFor(profileUrl, key), JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    /* best-effort */
  }
}

// Returns { savedAt, data } or null when absent/corrupt.
export async function cacheGet(profileUrl, key) {
  try {
    const s = await AsyncStorage.getItem(keyFor(profileUrl, key))
    if (!s) return null
    const o = JSON.parse(s)
    return o && 'data' in o ? o : null
  } catch {
    return null
  }
}

export async function cacheClear(profileUrl) {
  try {
    const all = await AsyncStorage.getAllKeys()
    const mine = all.filter((k) => k.startsWith(`${PREFIX}${profileUrl || ''}::`))
    if (mine.length) await AsyncStorage.multiRemove(mine)
  } catch {
    /* ignore */
  }
}
